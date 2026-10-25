-- "מד זמן פעילות": user_profiles.active_seconds - הערכה של הזמן שהמשתמש
-- פעיל באפליקציה, לניהול (מיון שדכנים ומשתמשים).
--
-- touch_last_seen נקראת מה-proxy לכל היותר פעם ב-5 דקות בזמן פעילות. כשהפער
-- מהפעם הקודמת קצר מ-10 דקות (פעמיים מרווח ה-throttle) זו אותה ישיבה, והפער
-- נוסף לסכום; פער ארוך יותר הוא ישיבה חדשה ואינו נספר. לכן זה דיוק של כמה
-- דקות - מספיק להשוואה בין משתמשים, לא למדידה מדויקת.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS active_seconds bigint NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.user_profiles.active_seconds IS
  'הערכת זמן הפעילות המצטבר באפליקציה, בשניות (מעודכן ב-touch_last_seen).';

CREATE OR REPLACE FUNCTION public.touch_last_seen()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  UPDATE public.user_profiles
     SET active_seconds = active_seconds + CASE
           WHEN last_seen_at IS NOT NULL
            AND last_seen_at > now() - interval '10 minutes'
           THEN extract(epoch FROM now() - last_seen_at)::bigint
           ELSE 0
         END,
         last_seen_at = now()
   WHERE id = auth.uid()
     AND (last_seen_at IS NULL OR last_seen_at < now() - interval '1 minute');
$function$;

NOTIFY pgrst, 'reload schema';

-- ── rollback ─────────────────────────────────────────────────────────
--   ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS active_seconds;
--   (ולהחזיר את touch_last_seen מ-20261028130000_user_last_seen.sql)
