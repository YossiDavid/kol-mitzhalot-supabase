-- יומן פעילות ושינויים אחרונים במערכת (/app/admin/activity).
--
-- public.activity_log: שורה לכל פעולה מהותית - כרטיסים (יצירה, אישור/דחייה,
-- השהיה, מחיקה, שינוי סטטוס אישי או השתתפות בשידוכים), הצעות (יצירה, שינוי
-- סטטוס, השלמת שליחה לצד השני), בקשות הצטרפות כשדכן (שינוי סטטוס), ושינויי
-- תפקידים (נרשמים מה-route, כי התפקידים ב-app_metadata של auth).
--
-- פרטיות: details שומר רק שמות עמודות שהשתנו וערכי סטטוס - לא את השורה.
-- summary מכיל שם כרטיס/צמד לזיהוי מהיר; היומן נקרא למנהל בלבד.
--
-- גישה: קריאה למנהל בלבד (RLS). אין כתיבה מהלקוח - רק טריגרים (SECURITY
-- DEFINER) ו-service role. המבצע: auth.uid(), ובכתיבה של service role (אין
-- סשן) - המבצע שה-RPC הציב (app.shidduch_actor) או עמודת "מי ביצע" של השורה.
--
-- כשל ברישום אינו מכשיל את הפעולה עצמה: נרשם WARNING ביומן של Postgres.
--
-- שמירה (retention): אין מחיקה אוטומטית. אם היומן יגדל - למחוק שורות ישנות
-- מ-12 חודשים (pg_cron או ידנית): DELETE FROM public.activity_log WHERE at < now() - interval '12 months';
-- אידמפוטנטית; להחלה: psql --single-transaction -v ON_ERROR_STOP=1 -f <file>

-- ── 1. הטבלה ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.activity_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  at          timestamptz NOT NULL DEFAULT now(),
  actor_id    uuid NULL,
  action      text NOT NULL,
  entity_type text NOT NULL,
  entity_id   uuid NULL,
  summary     text NOT NULL DEFAULT '',
  details     jsonb NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.activity_log IS
  'יומן פעילות לניהול: מי עשה מה ומתי. קריאה למנהל בלבד, כתיבה מטריגרים ו-service role.';

CREATE INDEX IF NOT EXISTS activity_log_at_idx ON public.activity_log (at DESC);
CREATE INDEX IF NOT EXISTS activity_log_entity_idx ON public.activity_log (entity_type, at DESC);
CREATE INDEX IF NOT EXISTS activity_log_actor_idx ON public.activity_log (actor_id, at DESC);
CREATE INDEX IF NOT EXISTS activity_log_entity_id_idx ON public.activity_log (entity_id);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.activity_log FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;

DROP POLICY IF EXISTS "Activity log select admin only" ON public.activity_log;
CREATE POLICY "Activity log select admin only" ON public.activity_log
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- ── 2. עזרים ────────────────────────────────────────────────────────

-- המבצע: הסשן, ואם אין (service role) - מה שה-RPC הציב, ואחרון - ברירת המחדל
-- של השורה (למשל admin_approved_by)
CREATE OR REPLACE FUNCTION public.activity_actor(p_fallback uuid DEFAULT NULL)
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    auth.uid(),
    NULLIF(current_setting('app.shidduch_actor', true), '')::uuid,
    p_fallback
  );
$function$;

-- העמודות (מתוך רשימה) שערכן השתנה בין שתי גרסאות השורה
CREATE OR REPLACE FUNCTION public.activity_changed_columns(
  p_old jsonb, p_new jsonb, p_columns text[]
)
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT COALESCE(array_agg(c ORDER BY c), '{}')
    FROM unnest(p_columns) AS c
   WHERE (p_old -> c) IS DISTINCT FROM (p_new -> c);
$function$;

CREATE OR REPLACE FUNCTION public.activity_record(
  p_actor uuid, p_action text, p_entity_type text, p_entity_id uuid,
  p_summary text, p_details jsonb
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.activity_log (actor_id, action, entity_type, entity_id, summary, details)
  VALUES (p_actor, p_action, p_entity_type, p_entity_id, COALESCE(p_summary, ''), COALESCE(p_details, '{}'::jsonb));
EXCEPTION WHEN OTHERS THEN
  -- היומן לעולם אינו מכשיל את הפעולה שהוא מתעד
  RAISE WARNING 'activity_record failed (%): %', p_action, SQLERRM;
END;
$function$;

ALTER FUNCTION public.activity_actor(uuid) OWNER TO postgres;
ALTER FUNCTION public.activity_changed_columns(jsonb, jsonb, text[]) OWNER TO postgres;
ALTER FUNCTION public.activity_record(uuid, text, text, uuid, text, jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.activity_record(uuid, text, text, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activity_record(uuid, text, text, uuid, text, jsonb) TO service_role;

-- ── 3. כרטיסים ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_student_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  -- השדות המהותיים בלבד: עריכה רגילה של הכרטיס (שלבי הטופס) אינה נרשמת
  c_key_columns CONSTANT text[] := ARRAY[
    'user_id', 'first_name', 'last_name', 'gender', 'birth_date',
    'personal_status', 'in_shidduchim', 'card_for',
    'admin_approved_at', 'admin_rejected_at', 'admin_paused_at', 'deleted_at',
    'third_party_full_display_approved_at', 'third_party_proposals_approved_at',
    'proposal_limit_count', 'proposal_limit_period', 'is_kohen'
  ];
  v_name     text;
  v_changed  text[];
  v_action   text;
  v_fallback uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_name := btrim(COALESCE(OLD.first_name, '') || ' ' || COALESCE(OLD.last_name, ''));
  ELSE
    v_name := btrim(COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''));
  END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.activity_record(
      public.activity_actor(NEW.user_id), 'student.created', 'student', NEW.id,
      'נוצר כרטיס: ' || v_name,
      jsonb_build_object('card_for', NEW.card_for, 'approved', NEW.admin_approved_at IS NOT NULL));
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM public.activity_record(
      public.activity_actor(NULL), 'student.purged', 'student', OLD.id,
      'כרטיס נמחק לצמיתות: ' || v_name, '{}'::jsonb);
    RETURN OLD;
  END IF;

  v_changed := public.activity_changed_columns(to_jsonb(OLD), to_jsonb(NEW), c_key_columns);
  IF cardinality(v_changed) = 0 THEN
    RETURN NEW;
  END IF;

  -- הפעולה העיקרית לפי סדר חשיבות; שאר השינויים ב-details
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    v_action := 'student.deleted';   v_fallback := NEW.deleted_by;
  ELSIF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
    v_action := 'student.restored';
  ELSIF NEW.admin_approved_at IS NOT NULL AND OLD.admin_approved_at IS NULL THEN
    v_action := 'student.approved';  v_fallback := NEW.admin_approved_by;
  ELSIF NEW.admin_rejected_at IS NOT NULL AND OLD.admin_rejected_at IS NULL THEN
    v_action := 'student.rejected';  v_fallback := NEW.admin_rejected_by;
  ELSIF NEW.admin_paused_at IS NOT NULL AND OLD.admin_paused_at IS NULL THEN
    v_action := 'student.paused';    v_fallback := NEW.admin_paused_by;
  ELSIF NEW.admin_paused_at IS NULL AND OLD.admin_paused_at IS NOT NULL THEN
    v_action := 'student.unpaused';
  ELSIF NEW.personal_status IS DISTINCT FROM OLD.personal_status THEN
    v_action := 'student.personal_status';
  ELSIF NEW.in_shidduchim IS DISTINCT FROM OLD.in_shidduchim THEN
    v_action := 'student.in_shidduchim';
  ELSE
    v_action := 'student.updated';
  END IF;

  PERFORM public.activity_record(
    public.activity_actor(v_fallback), v_action, 'student', NEW.id,
    v_name,
    jsonb_strip_nulls(jsonb_build_object(
      'changed', to_jsonb(v_changed),
      'personal_status', CASE WHEN 'personal_status' = ANY (v_changed)
        THEN jsonb_build_object('from', OLD.personal_status, 'to', NEW.personal_status) END,
      'in_shidduchim', CASE WHEN 'in_shidduchim' = ANY (v_changed)
        THEN jsonb_build_object('from', OLD.in_shidduchim, 'to', NEW.in_shidduchim) END
    )));
  RETURN NEW;
END;
$function$;

ALTER FUNCTION public.log_student_activity() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.log_student_activity() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trigger_log_student_activity ON public.students;
CREATE TRIGGER trigger_log_student_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.log_student_activity();

-- ── 4. הצעות ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_shidduch_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_groom  text;
  v_bride  text;
  v_pair   text;
  v_action text;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.status IS NOT DISTINCT FROM OLD.status
     AND NEW.recipient_scope IS NOT DISTINCT FROM OLD.recipient_scope THEN
    RETURN NEW;
  END IF;

  SELECT btrim(s.first_name || ' ' || s.last_name) INTO v_groom FROM public.students s WHERE s.id = NEW.groom_id;
  SELECT btrim(s.first_name || ' ' || s.last_name) INTO v_bride FROM public.students s WHERE s.id = NEW.bride_id;
  v_pair := COALESCE(v_groom, '?') || ' - ' || COALESCE(v_bride, '?');

  IF TG_OP = 'INSERT' THEN
    v_action := 'shidduch.created';
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    v_action := 'shidduch.status';
  ELSE
    v_action := 'shidduch.scope';
  END IF;

  PERFORM public.activity_record(
    public.activity_actor(CASE WHEN TG_OP = 'INSERT' THEN NEW.shadchan_id END),
    v_action, 'shidduch', NEW.id, v_pair,
    jsonb_strip_nulls(jsonb_build_object(
      'status_from', CASE WHEN TG_OP = 'UPDATE' THEN OLD.status::text END,
      'status_to', NEW.status::text,
      'scope_from', CASE WHEN TG_OP = 'UPDATE' THEN OLD.recipient_scope END,
      'scope_to', NEW.recipient_scope
    )));
  RETURN NEW;
END;
$function$;

ALTER FUNCTION public.log_shidduch_activity() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.log_shidduch_activity() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trigger_log_shidduch_activity ON public.shidduchim;
CREATE TRIGGER trigger_log_shidduch_activity
  AFTER INSERT OR UPDATE OF status, recipient_scope ON public.shidduchim
  FOR EACH ROW EXECUTE FUNCTION public.log_shidduch_activity();

-- ── 5. בקשות הצטרפות כשדכן ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_shadchan_application_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_name text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.application_status IS NOT DISTINCT FROM OLD.application_status THEN
    RETURN NEW;
  END IF;

  SELECT NULLIF(btrim(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), '')
    INTO v_name FROM public.user_profiles p WHERE p.id = NEW.user_id;

  PERFORM public.activity_record(
    public.activity_actor(NULL), 'shadchan_application.status',
    'shadchan_application', NEW.user_id, COALESCE(v_name, 'שדכן'),
    jsonb_strip_nulls(jsonb_build_object(
      'status_from', CASE WHEN TG_OP = 'UPDATE' THEN OLD.application_status END,
      'status_to', NEW.application_status
    )));
  RETURN NEW;
END;
$function$;

ALTER FUNCTION public.log_shadchan_application_activity() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.log_shadchan_application_activity() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trigger_log_shadchan_application_activity ON public.shadchanim_info;
CREATE TRIGGER trigger_log_shadchan_application_activity
  AFTER INSERT OR UPDATE OF application_status ON public.shadchanim_info
  FOR EACH ROW EXECUTE FUNCTION public.log_shadchan_application_activity();

NOTIFY pgrst, 'reload schema';

-- ── rollback ─────────────────────────────────────────────────────────
--   DROP TRIGGER IF EXISTS trigger_log_student_activity ON public.students;
--   DROP TRIGGER IF EXISTS trigger_log_shidduch_activity ON public.shidduchim;
--   DROP TRIGGER IF EXISTS trigger_log_shadchan_application_activity ON public.shadchanim_info;
--   DROP FUNCTION IF EXISTS public.log_student_activity();
--   DROP FUNCTION IF EXISTS public.log_shidduch_activity();
--   DROP FUNCTION IF EXISTS public.log_shadchan_application_activity();
--   DROP FUNCTION IF EXISTS public.activity_record(uuid, text, text, uuid, text, jsonb);
--   DROP FUNCTION IF EXISTS public.activity_changed_columns(jsonb, jsonb, text[]);
--   DROP FUNCTION IF EXISTS public.activity_actor(uuid);
--   DROP TABLE IF EXISTS public.activity_log;
