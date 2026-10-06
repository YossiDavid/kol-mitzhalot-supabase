-- ════════════════════════════════════════════════════════════════════════
-- מנהל מעניק תפקיד "איש צוות" דרך עורך התפקידים: השיוך למוסדות נוצר יחד עם
-- התפקיד.
--
-- הבעיה: staff_can_access_student דורש (א) תפקיד staff, (ב) staff_info מאושר,
-- (ג) שורת staff_institutions למוסד של הכרטיס. עורך התפקידים כתב רק את התפקיד
-- (ולכן איש הצוות לא ראה אף כרטיס). מסלול ההגשה והאישור לא מושפע.
--
-- admin_set_staff_institutions(user, institutions) - פעולה אטומית אחת:
--   * רשימה לא ריקה: staff_info נוצר/מאושר (application_status='approved',
--     approved_at רק אם טרם אושר; טקסטים של המגיש - city/position - לא נדרסים),
--     ו-staff_institutions של המשתמש הופך להיות בדיוק הרשימה (חסרים נוספים,
--     מוסרים נמחקים; position של שיוך שנשאר נשמר).
--   * רשימה ריקה (הסרת התפקיד): נמחקים כל שיוכי המוסדות; staff_info נשאר
--     כהיסטוריה כמו שהוא (כולל application_status). הגישה כבר נחתכת בבדיקת
--     התפקיד ב-staff_can_access_student.
--
-- רק service_role: הנתיב app/api/v1/admin/users/[userId]/roles (אחרי בדיקת
-- מנהל) קורא לה עם מפתח השרת. אידמפוטנטית.
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_set_staff_institutions(
  p_user_id uuid,
  p_institution_ids uuid[]
) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  v_ids uuid[];
  v_missing uuid[];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'user % not found', p_user_id USING ERRCODE = 'P0002';
  END IF;

  -- בלי כפילויות ובלי NULL, ובסדר קבוע
  SELECT COALESCE(array_agg(DISTINCT x ORDER BY x), '{}')
    INTO v_ids
    FROM unnest(COALESCE(p_institution_ids, '{}')) AS x
    WHERE x IS NOT NULL;

  -- הסרת תפקיד: רק מנקים את השיוכים
  IF cardinality(v_ids) = 0 THEN
    DELETE FROM public.staff_institutions WHERE user_id = p_user_id;
    RETURN;
  END IF;

  SELECT COALESCE(array_agg(x), '{}') INTO v_missing
    FROM unnest(v_ids) AS x
    WHERE NOT EXISTS (
      SELECT 1 FROM public.institutions i WHERE i.id = x AND i.is_active
    );
  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION 'institutions not found or inactive: %', v_missing
      USING ERRCODE = 'P0002';
  END IF;

  -- institution_id ב-staff_info היא העמודה הישנה: נשארת אם עדיין ברשימה,
  -- אחרת השיוך הראשון
  INSERT INTO public.staff_info
    (user_id, institution_id, application_status, approved_at)
  VALUES (p_user_id, v_ids[1], 'approved', now())
  ON CONFLICT (user_id) DO UPDATE SET
    institution_id = CASE
      WHEN public.staff_info.institution_id = ANY (v_ids)
        THEN public.staff_info.institution_id
      ELSE v_ids[1]
    END,
    approved_at = CASE
      WHEN public.staff_info.application_status = 'approved'
        AND public.staff_info.approved_at IS NOT NULL
        THEN public.staff_info.approved_at
      ELSE now()
    END,
    application_status = 'approved',
    rejected_at = NULL,
    rejected_reason = NULL;

  DELETE FROM public.staff_institutions
    WHERE user_id = p_user_id AND NOT (institution_id = ANY (v_ids));

  INSERT INTO public.staff_institutions (user_id, institution_id)
    SELECT p_user_id, x FROM unnest(v_ids) AS x
    ON CONFLICT (user_id, institution_id) DO NOTHING;
END;
$$;

ALTER FUNCTION public.admin_set_staff_institutions(uuid, uuid[]) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.admin_set_staff_institutions(uuid, uuid[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_staff_institutions(uuid, uuid[])
  TO service_role;
