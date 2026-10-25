-- "פעיל לאחרונה" בכותרת הצ'אט: last_seen_at של הצד השני בחדר.
-- user_profiles פתוחה לקריאה רק לבעלים ולמנהל, ולכן פונקציה SECURITY DEFINER
-- שמחזירה ערך אחד בלבד, ורק למי שהוא אחד משני המשתתפים בחדר.

CREATE OR REPLACE FUNCTION public.get_chat_partner_last_seen(p_room_id uuid)
 RETURNS timestamptz
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.last_seen_at
    FROM public.chat_rooms r
    JOIN public.user_profiles p
      ON p.id = CASE WHEN r.user_a = auth.uid() THEN r.user_b ELSE r.user_a END
   WHERE r.room_id = p_room_id
     AND auth.uid() IN (r.user_a, r.user_b);
$function$;

ALTER FUNCTION public.get_chat_partner_last_seen(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_chat_partner_last_seen(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_chat_partner_last_seen(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ── rollback ─────────────────────────────────────────────────────────
--   DROP FUNCTION IF EXISTS public.get_chat_partner_last_seen(uuid);
