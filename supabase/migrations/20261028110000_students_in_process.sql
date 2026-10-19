-- לוח העבודה: אילו מהמועמדים "בתהליך" - יש להם הצעה פתוחה בסטטוס interested
-- או in_progress, של כל שדכן.
--
-- שדכן רואה ב-shidduchim רק את ההצעות שלו (RLS), ולכן התשובה מגיעה מפונקציה
-- SECURITY DEFINER שמחזירה רק את מזהי הכרטיסים (מתוך מה שנשאל) שבתהליך - בלי
-- פרטי ההצעה, הצד השני או השדכן. לשדכנים ולמנהלים בלבד, ועד 500 מזהים בקריאה.
-- אידמפוטנטית; להחלה: psql --single-transaction -v ON_ERROR_STOP=1 -f <file>

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
    SELECT DISTINCT x.student_id
      FROM public.shidduchim sh
     CROSS JOIN LATERAL (VALUES (sh.groom_id), (sh.bride_id)) AS x(student_id)
     WHERE sh.status::text IN ('interested', 'in_progress')
       AND (sh.groom_id = ANY (p_student_ids) OR sh.bride_id = ANY (p_student_ids))
       AND x.student_id = ANY (p_student_ids);
END;
$function$;

ALTER FUNCTION public.students_in_process(uuid[]) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.students_in_process(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.students_in_process(uuid[]) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- ── rollback ─────────────────────────────────────────────────────────
--   DROP FUNCTION IF EXISTS public.students_in_process(uuid[]);
