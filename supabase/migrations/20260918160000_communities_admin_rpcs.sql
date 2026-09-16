-- ניהול מאגר החסידויות והקהילות במסך המנהל (/app/admin/communities).
--
-- הערך של "חסידות או קהילה" נשמר בכרטיס כטקסט חופשי - ב-students.community
-- וב-education_history.community - והטבלה public.communities היא מקור הצעות
-- בלבד (ראה 20260917140000_communities_catalog.sql). מכאן נובעות שתי דרישות
-- שאי אפשר לממש מצד הלקוח:
--
--   1. ספירת שימוש: כמה כרטיסים משתמשים בפועל בכל ערך. ההשוואה זהה לאינדקס
--      הייחודי של הטבלה - lower(btrim(name)) - כדי ש"בעלזא " ו-"בעלזא" ייספרו
--      יחד. ספירה בצד הלקוח הייתה דורשת משיכת כל הכרטיסים.
--
--   2. מיזוג כפילויות ("ויז׳ניץ" מול "וויזניץ"): העברת הטקסט שבכרטיסים לשם
--      היעד. זו כתיבה לנתוני מיועדים, ולכן היא SECURITY DEFINER עם בדיקת
--      public.is_admin() בתוך הפונקציה.
--
-- מה נספר: רק כרטיסים חיים (students.deleted_at IS NULL), וגם שורות ההשכלה
-- נספרות דרך המיועד שלהן - כדי שכרטיס שנמחק לא ימנע ניקוי של המאגר. המיזוג
-- לעומת זאת מעדכן כל שורה שהערך שלה תואם, כולל כרטיסים שנמחקו רכות, כדי
-- שהשם הישן לא יחזור אם כרטיס כזה ישוחזר.
--
-- אידמפוטנטית - ניתן להריץ שוב.

-- ── ספירת השימוש בכל ערך ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_community_usage()
RETURNS TABLE (name_key text, students_count bigint, education_count bigint)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_allowed'
      USING HINT = 'ספירת השימוש בקהילות מותרת למנהל בלבד';
  END IF;

  RETURN QUERY
  SELECT
    usage.key                                             AS name_key,
    COUNT(*) FILTER (WHERE usage.source = 'student')::bigint   AS students_count,
    COUNT(*) FILTER (WHERE usage.source = 'education')::bigint AS education_count
  FROM (
    SELECT LOWER(BTRIM(s.community)) AS key, 'student'::text AS source
    FROM public.students s
    WHERE s.deleted_at IS NULL
      AND BTRIM(COALESCE(s.community, '')) <> ''
    UNION ALL
    SELECT LOWER(BTRIM(e.community)), 'education'::text
    FROM public.education_history e
    JOIN public.students s ON s.id = e.student_id AND s.deleted_at IS NULL
    WHERE BTRIM(COALESCE(e.community, '')) <> ''
  ) usage
  GROUP BY usage.key;
END;
$$;

ALTER FUNCTION public.admin_community_usage() OWNER TO postgres;

COMMENT ON FUNCTION public.admin_community_usage()
  IS 'ספירת השימוש בכל ערך קהילה בכרטיסים החיים, לפי lower(btrim(name)). מנהל בלבד.';

REVOKE ALL ON FUNCTION public.admin_community_usage() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_community_usage() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_community_usage() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_community_usage() TO service_role;

-- ── מיזוג שתי קהילות ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_merge_communities(
  p_source_id uuid,
  p_target_id uuid
) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  v_source_name text;
  v_target_name text;
  v_source_key  text;
  v_students    bigint := 0;
  v_education   bigint := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_allowed'
      USING HINT = 'מיזוג קהילות מותר למנהל בלבד';
  END IF;

  IF p_source_id IS NULL OR p_target_id IS NULL THEN
    RAISE EXCEPTION 'community_required'
      USING HINT = 'יש לבחור קהילת מקור וקהילת יעד';
  END IF;

  IF p_source_id = p_target_id THEN
    RAISE EXCEPTION 'community_merge_into_itself'
      USING HINT = 'אי אפשר למזג קהילה לתוך עצמה';
  END IF;

  SELECT BTRIM(name) INTO v_source_name
  FROM public.communities WHERE id = p_source_id;

  IF v_source_name IS NULL THEN
    RAISE EXCEPTION 'community_source_not_found'
      USING HINT = 'קהילת המקור לא נמצאה';
  END IF;

  SELECT BTRIM(name) INTO v_target_name
  FROM public.communities WHERE id = p_target_id;

  IF v_target_name IS NULL THEN
    RAISE EXCEPTION 'community_target_not_found'
      USING HINT = 'קהילת היעד לא נמצאה';
  END IF;

  v_source_key := LOWER(v_source_name);

  UPDATE public.students
  SET community = v_target_name
  WHERE LOWER(BTRIM(community)) = v_source_key;
  GET DIAGNOSTICS v_students = ROW_COUNT;

  UPDATE public.education_history
  SET community = v_target_name
  WHERE LOWER(BTRIM(community)) = v_source_key;
  GET DIAGNOSTICS v_education = ROW_COUNT;

  -- אחרי ההעברה אין לשם המקור אף שימוש, ולכן הוא נמחק מהמאגר ולא רק מושבת:
  -- ערך מושבת היה ממשיך להופיע ברשימת המנהל כרעש.
  DELETE FROM public.communities WHERE id = p_source_id;

  RETURN jsonb_build_object(
    'source_name',       v_source_name,
    'target_name',       v_target_name,
    'students_updated',  v_students,
    'education_updated', v_education,
    'rows_updated',      v_students + v_education
  );
END;
$$;

ALTER FUNCTION public.admin_merge_communities(uuid, uuid) OWNER TO postgres;

COMMENT ON FUNCTION public.admin_merge_communities(uuid, uuid)
  IS 'מיזוג קהילה כפולה: הטקסט בכרטיסים ובשורות ההשכלה עובר לשם היעד, וקהילת המקור נמחקת מהמאגר. מחזיר את מספר השורות שעודכנו. מנהל בלבד.';

REVOKE ALL ON FUNCTION public.admin_merge_communities(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_merge_communities(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_merge_communities(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_merge_communities(uuid, uuid) TO service_role;

-- ── מחיקה של ערך שנמצא בשימוש נחסמת ───────────────────────────────
-- המסך מציג את מספר הכרטיסים ומציע השבתה או מיזוג, אבל הכלל עצמו יושב במסד:
-- גם מחיקה ישירה (service role, psql) לא תשאיר כרטיסים עם ערך שנעלם מהמאגר.
CREATE OR REPLACE FUNCTION public.communities_block_delete_in_use() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_key   text := LOWER(BTRIM(OLD.name));
  v_count bigint;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.students s
  WHERE s.deleted_at IS NULL
    AND LOWER(BTRIM(s.community)) = v_key;

  IF v_count = 0 THEN
    SELECT COUNT(*) INTO v_count
    FROM public.education_history e
    JOIN public.students s ON s.id = e.student_id AND s.deleted_at IS NULL
    WHERE LOWER(BTRIM(e.community)) = v_key;
  END IF;

  IF v_count > 0 THEN
    RAISE EXCEPTION 'community_in_use'
      USING HINT = 'הקהילה מופיעה בכרטיסים קיימים. אפשר לסמן אותה כלא פעילה או למזג אותה לקהילה אחרת.';
  END IF;

  RETURN OLD;
END;
$$;

ALTER FUNCTION public.communities_block_delete_in_use() OWNER TO postgres;

DROP TRIGGER IF EXISTS trigger_communities_block_delete_in_use ON public.communities;
CREATE TRIGGER trigger_communities_block_delete_in_use
  BEFORE DELETE ON public.communities
  FOR EACH ROW EXECUTE FUNCTION public.communities_block_delete_in_use();
