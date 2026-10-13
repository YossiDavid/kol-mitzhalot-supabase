-- ════════════════════════════════════════════════════════════════════
-- טלפון ואימייל של שדכן בפרופיל המלא: רק לשדכן עצמו ולמנהל
-- ════════════════════════════════════════════════════════════════════
-- החלטת הבעלים: לא חושפים לשאר המשתמשים את הטלפון והאימייל של שדכן,
-- כדי להגביל עקיפת המערכת. הפנייה לשדכן עוברת דרך "פנייה לשדכן"
-- (claim_shadchan_contact + צ'אט).
--
-- get_shadchan_public_profile (העמוד "לפרופיל המלא") מחזירה phone/email רק
-- כש-auth.uid() הוא השדכן עצמו או כש-is_admin(); לכל אחד אחר NULL.
-- רשימת השדכנים (list_approved_shadchanim) כבר מחזירה NULL בשתי העמודות.
--
-- לא משתנה: סוג ההחזרה ורשימת העמודות, ה-SECURITY DEFINER, ה-search_path
-- וההרשאות. shadchan_public_profiles (הפנימית) לא נוגעים בה, ולכן
-- get_shadchanim_who_acted_for_me ממשיכה להחזיר את העמודות - ראו את הדוח.
--
-- אידמפוטנטית: CREATE OR REPLACE עם אותה חתימה. ההרשאות מוגדרות מחדש
-- (REVOKE/GRANT) לאותו מצב.

CREATE OR REPLACE FUNCTION public.get_shadchan_public_profile(p_shadchan_id uuid)
RETURNS TABLE (
  shadchan_id      uuid,
  first_name       text,
  last_name        text,
  avatar_url       text,
  since_year       integer,
  phone            text,
  email            text,
  city             text,
  description      text,
  experience_years integer,
  closed_matches   integer,
  specializations  text[],
  languages        text[]
)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  SELECT pp.shadchan_id, pp.first_name, pp.last_name, pp.avatar_url, pp.since_year,
         CASE WHEN auth.uid() = pp.shadchan_id OR public.is_admin()
              THEN pp.phone END,
         CASE WHEN auth.uid() = pp.shadchan_id OR public.is_admin()
              THEN pp.email END,
         pp.city, pp.description, pp.experience_years, pp.closed_matches,
         pp.specializations, pp.languages
  FROM public.shadchan_public_profiles(ARRAY[p_shadchan_id]) pp
  WHERE auth.uid() IS NOT NULL
    AND public.is_contactable_shadchan(p_shadchan_id);
$$;

ALTER FUNCTION public.get_shadchan_public_profile(uuid) OWNER TO postgres;

COMMENT ON FUNCTION public.get_shadchan_public_profile(uuid)
  IS 'הכרטיס הציבורי של שדכן, למשתמש מחובר. טלפון ואימייל רק לשדכן עצמו ולמנהל, לאחרים NULL. ריק אם המזהה אינו של שדכן.';

REVOKE ALL ON FUNCTION public.get_shadchan_public_profile(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_shadchan_public_profile(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_shadchan_public_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_shadchan_public_profile(uuid) TO service_role;

-- ── Rollback (ההגדרה הקודמת, מ-20260910120000) ────────────────────
-- CREATE OR REPLACE FUNCTION public.get_shadchan_public_profile(p_shadchan_id uuid)
-- RETURNS TABLE (
--   shadchan_id      uuid,
--   first_name       text,
--   last_name        text,
--   avatar_url       text,
--   since_year       integer,
--   phone            text,
--   email            text,
--   city             text,
--   description      text,
--   experience_years integer,
--   closed_matches   integer,
--   specializations  text[],
--   languages        text[]
-- )
--     LANGUAGE sql STABLE SECURITY DEFINER
--     SET search_path TO 'public', 'auth'
--     AS $$
--   SELECT pp.*
--   FROM public.shadchan_public_profiles(ARRAY[p_shadchan_id]) pp
--   WHERE auth.uid() IS NOT NULL
--     AND public.is_contactable_shadchan(p_shadchan_id);
-- $$;
-- COMMENT ON FUNCTION public.get_shadchan_public_profile(uuid)
--   IS 'הכרטיס הציבורי של שדכן, למשתמש מחובר. ריק אם המזהה אינו של שדכן.';
