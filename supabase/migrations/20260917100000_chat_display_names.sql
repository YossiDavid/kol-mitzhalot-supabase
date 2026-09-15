-- שמות תצוגה בצ'אטים: הצ'אט הציג את תחילת ה-uid במקום שם המשתמש.
--
-- רקע:
--   • get_user_metadata קורא את השם מ-public.user_profiles. שורה שם נוצרת
--     בטריגר on_auth_user_created (sync_user_profile) - אבל הטריגר יושב על
--     auth.users ולכן לא נכלל ב-dump של הבסיס (remote_baseline). בסביבה שהוקמה
--     מהמיגרציות אין טריגר, ולמשתמשים אין פרופיל - והצ'אט נפל לתחילת ה-uid.
--   • get_user_metadata היה פתוח גם ל-anon ולכל משתמש, והחזיר שם ואימייל של
--     כל מזהה בלי בדיקה.
--
-- כאן:
--   1. הטריגר on_auth_user_created משוחזר (אם כבר קיים - נוצר מחדש זהה).
--   2. השלמת פרופילים חסרים מ-auth.users. לא דורס ערכים קיימים.
--   3. get_user_metadata: שם מהפרופיל, ובהיעדרו מ-auth.users; מחזיר נתונים
--      רק לעצמי, למי שחולק איתי שיחה, או לשדכן/מנהל. anon - ללא הרשאה.
--
-- אידמפוטנטית - ניתן להריץ שוב.

-- ── 1. הטריגר שממלא את user_profiles ───────────────────────────────
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_profile();

-- ── 2. השלמת פרופילים חסרים ───────────────────────────────────────
INSERT INTO public.user_profiles (id, first_name, last_name, email, updated_at)
SELECT
  u.id,
  COALESCE(
    NULLIF(TRIM(u.raw_user_meta_data->>'firstName'), ''),
    NULLIF(TRIM(u.raw_user_meta_data->>'first_name'), '')
  ),
  COALESCE(
    NULLIF(TRIM(u.raw_user_meta_data->>'lastName'), ''),
    NULLIF(TRIM(u.raw_user_meta_data->>'last_name'), '')
  ),
  u.email,
  NOW()
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;

-- ── 3. get_user_metadata ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_metadata(target_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR target_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- אותו כלל כמו מדיניות "Users can read profiles of users they chat with",
  -- ובנוסף שדכן/מנהל
  IF target_user_id <> v_uid
     AND NOT public.is_shadchan_or_admin()
     AND NOT EXISTS (
       SELECT 1
       FROM public.chat_room_participants crp1
       JOIN public.chat_room_participants crp2 ON crp1.room_id = crp2.room_id
       WHERE crp1.user_id = v_uid
         AND crp2.user_id = target_user_id
         AND crp1.deleted_before IS NULL
         AND crp2.deleted_before IS NULL
     ) THEN
    RETURN NULL;
  END IF;

  RETURN (
    SELECT jsonb_build_object(
      'id', u.id,
      'firstName', COALESCE(
        NULLIF(TRIM(p.first_name), ''),
        NULLIF(TRIM(u.raw_user_meta_data->>'firstName'), ''),
        NULLIF(TRIM(u.raw_user_meta_data->>'first_name'), '')
      ),
      'lastName', COALESCE(
        NULLIF(TRIM(p.last_name), ''),
        NULLIF(TRIM(u.raw_user_meta_data->>'lastName'), ''),
        NULLIF(TRIM(u.raw_user_meta_data->>'last_name'), '')
      ),
      'email', COALESCE(p.email, u.email)
    )
    FROM auth.users u
    LEFT JOIN public.user_profiles p ON p.id = u.id
    WHERE u.id = target_user_id
  );
END;
$$;

ALTER FUNCTION public.get_user_metadata(uuid) OWNER TO postgres;

COMMENT ON FUNCTION public.get_user_metadata(uuid)
  IS 'שם ואימייל של משתמש לתצוגה בצ''אט: מהפרופיל ובהיעדרו מ-auth.users. רק לעצמי, לשותף בשיחה או לשדכן/מנהל.';

REVOKE ALL ON FUNCTION public.get_user_metadata(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_metadata(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_user_metadata(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_metadata(uuid) TO service_role;
