-- "נראה לאחרונה" לניהול המשתמשים: user_profiles.last_seen_at.
--
-- מתעדכן מה-proxy (lib/supabase/proxy.ts) לכל היותר פעם בכמה דקות למשתמש
-- (עוגיית throttle), דרך touch_last_seen() - SECURITY DEFINER שמעדכנת רק את
-- השורה של המשתמש המחובר (auth.uid()). אין למשתמש הרשאת כתיבה ישירה לעמודה.
-- הקריאה: מנהל (RLS הקיים על user_profiles - בעלים או מנהל).
-- אידמפוטנטית; להחלה: psql --single-transaction -v ON_ERROR_STOP=1 -f <file>

ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

COMMENT ON COLUMN public.user_profiles.last_seen_at IS
  'הפעם האחרונה שהמשתמש נראה באפליקציה (מעודכן מה-proxy, בדיוק של כמה דקות).';

CREATE OR REPLACE FUNCTION public.touch_last_seen()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- רק השורה של המשתמש עצמו, ורק אם לא עודכנה בדקה האחרונה (חוסך כתיבות
  -- כשכמה בקשות מקבילות מגיעות לפני שעוגיית ה-throttle נשמרה)
  UPDATE public.user_profiles
     SET last_seen_at = now()
   WHERE id = auth.uid()
     AND (last_seen_at IS NULL OR last_seen_at < now() - interval '1 minute');
$function$;

ALTER FUNCTION public.touch_last_seen() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.touch_last_seen() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.touch_last_seen() TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ── rollback ─────────────────────────────────────────────────────────
--   DROP FUNCTION IF EXISTS public.touch_last_seen();
--   ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS last_seen_at;
