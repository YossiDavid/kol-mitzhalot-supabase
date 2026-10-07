-- תיקוני לקוח: פורום שדכנים ורשימת שדכנים.
--
-- רקע: הפורום והרשימה "לא פעילים" מבחינת הלקוח. בפורום, הקוד קרא ושלח את
-- העמודה body בעוד שבטבלה forum_posts העמודה נקראת content, ולכן הרשימה
-- חזרה ריקה וכל פרסום נכשל (תוקן בקוד, לא כאן). שני דברים נוספים דורשים DB:
--
--   1. קריאה: מדיניות ה-SELECT של הפורום הייתה USING (true) לכל משתמש
--      מחובר, כלומר גם הורה יכול היה לקרוא את הפורום דרך ה-API של Supabase
--      למרות שהוא פורום שדכנים. כותבים כבר הוגבלו לשדכן מאושר או מנהל
--      (security_hardening_2); כאן הקריאה מצטרפת אליהם. זה הידוק, לא החלשה.
--      מנהל כבר יכול לפרסם (is_admin בתנאי ה-INSERT), ולכן אין שינוי בכתיבה.
--   2. שמות הכותבים: user_profiles אינה קריאה לשדכן אחר, ו-
--      shadchan_public_profiles סגורה ל-authenticated. get_forum_author_names
--      מחזירה שם תצוגה בלבד, ורק לשדכן מאושר או מנהל.
--   3. רשימת שדכנים: אין עד היום דרך לרשימה, רק לפרופיל בודד לפי מזהה.
--      list_approved_shadchanim מחזירה שדכנים מאושרים בלבד ובלי טלפון ומייל
--      (הם זמינים בפרופיל המלא ובטופס הפנייה, שמנוהל במכסה יומית).
--
-- אידמפוטנטית - ניתן להריץ שוב על סביבה שכבר הוחלה עליה בלי שגיאה.

-- ── 1. קריאה בפורום: שדכן מאושר או מנהל ─────────────────────────────
DROP POLICY IF EXISTS forum_posts_select ON public.forum_posts;
CREATE POLICY forum_posts_select ON public.forum_posts
  FOR SELECT TO authenticated
  USING (public.is_approved_shadchan(auth.uid()) OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS forum_replies_select ON public.forum_replies;
CREATE POLICY forum_replies_select ON public.forum_replies
  FOR SELECT TO authenticated
  USING (public.is_approved_shadchan(auth.uid()) OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS likes_select ON public.forum_likes;
CREATE POLICY likes_select ON public.forum_likes
  FOR SELECT TO authenticated
  USING (public.is_approved_shadchan(auth.uid()) OR public.is_admin(auth.uid()));

-- ── 2. שמות כותבים בפורום ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_forum_author_names(p_ids uuid[])
RETURNS TABLE (user_id uuid, display_name text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  SELECT pp.shadchan_id,
         NULLIF(BTRIM(CONCAT_WS(' ', pp.first_name, pp.last_name)), '')
  FROM public.shadchan_public_profiles(p_ids) pp
  WHERE public.is_approved_shadchan(auth.uid()) OR public.is_admin(auth.uid());
$$;

ALTER FUNCTION public.get_forum_author_names(uuid[]) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.get_forum_author_names(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_forum_author_names(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_forum_author_names(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_forum_author_names(uuid[]) TO service_role;

COMMENT ON FUNCTION public.get_forum_author_names(uuid[])
  IS 'שם תצוגה של כותבי הפורום. רק לשדכן מאושר או מנהל';

-- ── 3. רשימת שדכנים ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.list_approved_shadchanim()
RETURNS TABLE (
  shadchan_id uuid, first_name text, last_name text, avatar_url text,
  since_year integer, phone text, email text, city text, description text,
  experience_years integer, closed_matches integer,
  specializations text[], languages text[]
)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  SELECT pp.shadchan_id, pp.first_name, pp.last_name, pp.avatar_url,
         pp.since_year,
         NULL::text, NULL::text,
         pp.city, pp.description, pp.experience_years, pp.closed_matches,
         pp.specializations, pp.languages
  FROM public.shadchan_public_profiles(ARRAY(
         SELECT si.user_id
         FROM public.shadchanim_info si
         WHERE si.application_status = 'approved'
           AND public.has_role(si.user_id, 'shadchan')
           AND si.user_id <> auth.uid()
       )) pp
  WHERE auth.uid() IS NOT NULL
  ORDER BY COALESCE(pp.last_name, ''), COALESCE(pp.first_name, '');
$$;

ALTER FUNCTION public.list_approved_shadchanim() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.list_approved_shadchanim() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_approved_shadchanim() FROM anon;
GRANT EXECUTE ON FUNCTION public.list_approved_shadchanim() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_approved_shadchanim() TO service_role;

COMMENT ON FUNCTION public.list_approved_shadchanim()
  IS 'רשימת שדכנים מאושרים למשתמש מחובר, בלי טלפון ומייל (הם בפרופיל המלא)';
