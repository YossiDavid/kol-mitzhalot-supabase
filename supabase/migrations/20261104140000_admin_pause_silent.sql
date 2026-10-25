-- השהיה שקטה של כרטיס בידי הנהלה: הכרטיס מוצא משידוכים כמו בהשהיה רגילה,
-- אבל מנהל הכרטיס ממשיך לראות אותו כפעיל (המיסוך בשרת: dashboard/lib/queries.ts
-- ו-students/lib/card-silent-pause.ts). אין התראה על השהיה - לא רגילה ולא שקטה.
-- רק מנהל או service role משנים את הדגל (enforce_student_admin_pause).

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS admin_pause_silent boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.students.admin_pause_silent IS
  'השהיית ההנהלה (admin_paused_at) שקטה: מנהל הכרטיס רואה את הכרטיס כפעיל.';

CREATE OR REPLACE FUNCTION public.enforce_student_admin_pause()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_is_trusted boolean := auth.uid() IS NULL OR public.is_admin();
BEGIN
  IF NOT v_is_trusted THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.admin_paused_at IS NOT NULL OR NEW.admin_paused_by IS NOT NULL
         OR NEW.admin_pause_silent THEN
        RAISE EXCEPTION 'admin_pause_forbidden' USING ERRCODE = '42501';
      END IF;
    ELSIF NEW.admin_paused_at IS DISTINCT FROM OLD.admin_paused_at
       OR NEW.admin_paused_by IS DISTINCT FROM OLD.admin_paused_by
       OR NEW.admin_pause_silent IS DISTINCT FROM OLD.admin_pause_silent THEN
      RAISE EXCEPTION 'admin_pause_forbidden' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.admin_paused_at IS NOT NULL THEN
    NEW.in_shidduchim := false;
  ELSE
    NEW.admin_pause_silent := false;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_enforce_student_admin_pause ON public.students;
CREATE TRIGGER trigger_enforce_student_admin_pause
  BEFORE INSERT OR UPDATE OF in_shidduchim, admin_paused_at, admin_paused_by, admin_pause_silent
  ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.enforce_student_admin_pause();

-- השהיה שקטה נחשבת "כרטיס פעיל" בבדיקת הגישה לשדכנים: אחרת מנהל הכרטיס
-- היה נחסם בפנייה לשדכנים ומגלה כך את ההשהיה (20261104130000)
CREATE OR REPLACE FUNCTION public.has_active_public_card(uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.students s
     WHERE s.user_id = uid
       AND s.deleted_at IS NULL
       AND s.admin_approved_at IS NOT NULL
       AND s.admin_exclusive_at IS NULL
       AND (s.admin_paused_at IS NULL OR s.admin_pause_silent)
       AND (s.in_shidduchim IS DISTINCT FROM false OR s.admin_pause_silent)
       AND s.personal_status NOT IN ('engaged', 'married')
  );
$function$;

-- ── rollback ─────────────────────────────────────────────────────────
--   ALTER TABLE public.students DROP COLUMN IF EXISTS admin_pause_silent;
--   (ולהחזיר את הפונקציה והטריגר מ-20261006100000_proposal_rules.sql)
