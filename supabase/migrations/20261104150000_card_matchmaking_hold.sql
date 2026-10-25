-- "בתהליך שידוך": מנהל הכרטיס או מנהל המערכת מסמנים שהכרטיס באמצע תהליך,
-- וזמנית אינו מקבל הצעות חדשות. הכרטיס נשאר גלוי ברשימה, עם הסיבה לשדכנים.
--
-- students.matchmaking_hold_at / _reason / _by. נכתבות רק דרך
-- set_card_matchmaking_hold (בעלים או מנהל); כתיבה ישירה נחסמת בטריגר.
-- student_proposal_quota מחזירה is_paused=true גם בזמן "בתהליך", כך שכל
-- מסלולי ההצעה (הטריגר ובדיקת השרת) חוסמים בלי שינוי נוסף.

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS matchmaking_hold_at timestamptz,
  ADD COLUMN IF NOT EXISTS matchmaking_hold_reason text,
  ADD COLUMN IF NOT EXISTS matchmaking_hold_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.students
  DROP CONSTRAINT IF EXISTS students_matchmaking_hold_reason_length_check;
ALTER TABLE public.students
  ADD CONSTRAINT students_matchmaking_hold_reason_length_check
  CHECK (matchmaking_hold_reason IS NULL OR char_length(matchmaking_hold_reason) <= 300);

COMMENT ON COLUMN public.students.matchmaking_hold_at IS
  'הכרטיס בתהליך שידוך וזמנית אינו מקבל הצעות (מנהל הכרטיס או ההנהלה).';
COMMENT ON COLUMN public.students.matchmaking_hold_reason IS
  'הסיבה שמוצגת לשדכנים בזמן "בתהליך שידוך".';

-- כתיבה רק דרך ה-RPC (שמציב app.matchmaking_hold_rpc) או service role
CREATE OR REPLACE FUNCTION public.guard_matchmaking_hold()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL
     OR current_setting('app.matchmaking_hold_rpc', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.matchmaking_hold_at := NULL;
    NEW.matchmaking_hold_reason := NULL;
    NEW.matchmaking_hold_by := NULL;
  ELSE
    NEW.matchmaking_hold_at := OLD.matchmaking_hold_at;
    NEW.matchmaking_hold_reason := OLD.matchmaking_hold_reason;
    NEW.matchmaking_hold_by := OLD.matchmaking_hold_by;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_guard_matchmaking_hold ON public.students;
CREATE TRIGGER trigger_guard_matchmaking_hold
  BEFORE INSERT OR UPDATE OF matchmaking_hold_at, matchmaking_hold_reason, matchmaking_hold_by
  ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.guard_matchmaking_hold();

CREATE OR REPLACE FUNCTION public.set_card_matchmaking_hold(
  p_student_id uuid,
  p_on boolean,
  p_reason text DEFAULT NULL
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_uid    uuid := auth.uid();
  v_owner  uuid;
  v_hold_by uuid;
  v_reason text := NULLIF(BTRIM(COALESCE(p_reason, '')), '');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;
  SELECT s.user_id, s.matchmaking_hold_by INTO v_owner, v_hold_by
    FROM public.students s
   WHERE s.id = p_student_id AND s.deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'card_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_owner IS DISTINCT FROM v_uid AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  -- סימון שהציבה ההנהלה מוסר רק בידי מנהל
  IF NOT p_on AND NOT public.is_admin()
     AND v_hold_by IS NOT NULL AND v_hold_by IS DISTINCT FROM v_uid
     AND public.has_role(v_hold_by, 'admin') THEN
    RAISE EXCEPTION 'hold_set_by_admin' USING ERRCODE = '42501';
  END IF;
  IF v_reason IS NOT NULL AND char_length(v_reason) > 300 THEN
    RAISE EXCEPTION 'reason_too_long' USING ERRCODE = '22001';
  END IF;

  PERFORM set_config('app.matchmaking_hold_rpc', 'on', true);
  UPDATE public.students
     SET matchmaking_hold_at     = CASE WHEN p_on THEN now() ELSE NULL END,
         matchmaking_hold_reason = CASE WHEN p_on THEN v_reason ELSE NULL END,
         matchmaking_hold_by     = CASE WHEN p_on THEN v_uid ELSE NULL END
   WHERE id = p_student_id;
  PERFORM set_config('app.matchmaking_hold_rpc', 'off', true);
END;
$function$;

ALTER FUNCTION public.set_card_matchmaking_hold(uuid, boolean, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.set_card_matchmaking_hold(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_card_matchmaking_hold(uuid, boolean, text) TO authenticated;

-- מצב "בתהליך" של כרטיס, לכל מי שרואה את הכרטיס (שדכן, מנהל, בעלים)
CREATE OR REPLACE FUNCTION public.get_card_matchmaking_hold(p_student_id uuid)
 RETURNS TABLE(hold_at timestamptz, reason text)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT s.matchmaking_hold_at, s.matchmaking_hold_reason
    FROM public.students s
   WHERE s.id = p_student_id
     AND s.matchmaking_hold_at IS NOT NULL
     AND s.deleted_at IS NULL
     AND (s.user_id = auth.uid() OR public.is_shadchan_or_admin());
$function$;

ALTER FUNCTION public.get_card_matchmaking_hold(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_card_matchmaking_hold(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_card_matchmaking_hold(uuid) TO authenticated;

-- מזהי הכרטיסים "בתהליך" מתוך רשימה (תג ברשימת הכרטיסים), לשדכן ולמנהל
CREATE OR REPLACE FUNCTION public.students_on_matchmaking_hold(p_ids uuid[])
 RETURNS TABLE(student_id uuid, reason text)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT s.id, s.matchmaking_hold_reason
    FROM public.students s
   WHERE s.id = ANY (p_ids)
     AND s.matchmaking_hold_at IS NOT NULL
     AND s.deleted_at IS NULL
     AND public.is_shadchan_or_admin();
$function$;

ALTER FUNCTION public.students_on_matchmaking_hold(uuid[]) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.students_on_matchmaking_hold(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.students_on_matchmaking_hold(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.student_proposal_quota(p_student_id uuid)
 RETURNS TABLE(is_paused boolean, limit_count integer, limit_period text, used_count integer, retry_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_student  record;
  v_window   interval;
  v_used     integer := 0;
  v_retry    timestamptz := NULL;
BEGIN
  SELECT s.in_shidduchim, s.admin_paused_at, s.matchmaking_hold_at,
         s.proposal_limit_count, s.proposal_limit_period
    INTO v_student
    FROM public.students s
   WHERE s.id = p_student_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_student.proposal_limit_count IS NOT NULL THEN
    v_window := CASE v_student.proposal_limit_period
      WHEN 'day'   THEN interval '1 day'
      WHEN 'week'  THEN interval '7 days'
      ELSE interval '1 month'
    END;

    SELECT count(*)::integer INTO v_used
      FROM public.shidduch_events e
     WHERE e.student_id = p_student_id
       AND e.created_at > now() - v_window;

    IF v_used >= v_student.proposal_limit_count THEN
      SELECT e.created_at + v_window INTO v_retry
        FROM public.shidduch_events e
       WHERE e.student_id = p_student_id
         AND e.created_at > now() - v_window
       ORDER BY e.created_at ASC
      OFFSET (v_used - v_student.proposal_limit_count)
       LIMIT 1;
    END IF;
  END IF;

  -- "בתהליך שידוך" חוסם הצעות חדשות כמו השהיה
  is_paused    := v_student.in_shidduchim IS NOT DISTINCT FROM false
                  OR v_student.admin_paused_at IS NOT NULL
                  OR v_student.matchmaking_hold_at IS NOT NULL;
  limit_count  := v_student.proposal_limit_count;
  limit_period := v_student.proposal_limit_period;
  used_count   := v_used;
  retry_at     := v_retry;
  RETURN NEXT;
END;
$function$;

NOTIFY pgrst, 'reload schema';

-- ── rollback ─────────────────────────────────────────────────────────
--   להחזיר את student_proposal_quota מ-20261006100000_proposal_rules.sql
--   DROP FUNCTION IF EXISTS public.students_on_matchmaking_hold(uuid[]);
--   DROP FUNCTION IF EXISTS public.get_card_matchmaking_hold(uuid);
--   DROP FUNCTION IF EXISTS public.set_card_matchmaking_hold(uuid, boolean, text);
--   DROP TRIGGER IF EXISTS trigger_guard_matchmaking_hold ON public.students;
--   DROP FUNCTION IF EXISTS public.guard_matchmaking_hold();
--   ALTER TABLE public.students DROP COLUMN IF EXISTS matchmaking_hold_by,
--     DROP COLUMN IF EXISTS matchmaking_hold_reason, DROP COLUMN IF EXISTS matchmaking_hold_at;

-- תג "בתהליך" בשולחן העבודה של השדכן: גם כרטיס שסומן "בתהליך שידוך"
CREATE OR REPLACE FUNCTION public.students_in_process(p_student_ids uuid[])
 RETURNS SETOF uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_shadchan_or_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(cardinality(p_student_ids), 0) > 500 THEN
    RAISE EXCEPTION 'too_many_ids' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
    SELECT x.student_id
      FROM public.shidduchim sh
     CROSS JOIN LATERAL (VALUES (sh.groom_id), (sh.bride_id)) AS x(student_id)
     WHERE sh.status::text IN ('interested', 'in_progress')
       AND (sh.groom_id = ANY (p_student_ids) OR sh.bride_id = ANY (p_student_ids))
       AND x.student_id = ANY (p_student_ids)
    UNION
    SELECT s.id
      FROM public.students s
     WHERE s.id = ANY (p_student_ids)
       AND s.matchmaking_hold_at IS NOT NULL;
END;
$function$;
