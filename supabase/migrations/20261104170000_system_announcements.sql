-- הודעות מערכת: הודעה מההנהלה שמוצגת כבאנר בכניסה לאפליקציה, עד שהמשתמש
-- מסמן "קראתי". קהל: כולם / שדכנים / משתמשים שאינם שדכנים. ההנהלה רואה מי
-- קרא כל הודעה, ותגובות מגיעות כצ'אט אל המנהל ששלח (כפתור "השבה להנהלה").
--
-- system_announcements: כתיבה רק למנהל (וה-service role). קריאה: מנהל - הכל;
-- משתמש - רק הודעות פעילות שהקהל שלהן כולל אותו.
-- system_announcement_reads: כל משתמש מסמן ורואה רק את שלו; מנהל רואה הכל.

CREATE TABLE IF NOT EXISTS public.system_announcements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
  body        text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
  audience    text NOT NULL DEFAULT 'all'
              CHECK (audience IN ('all', 'shadchanim', 'users')),
  is_active   boolean NOT NULL DEFAULT true,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.system_announcements IS
  'הודעות מערכת מההנהלה (באנר בכניסה). audience: all / shadchanim / users.';

CREATE INDEX IF NOT EXISTS system_announcements_active_idx
  ON public.system_announcements (created_at DESC) WHERE is_active;

CREATE TABLE IF NOT EXISTS public.system_announcement_reads (
  announcement_id uuid NOT NULL REFERENCES public.system_announcements(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (announcement_id, user_id)
);

CREATE INDEX IF NOT EXISTS system_announcement_reads_user_idx
  ON public.system_announcement_reads (user_id);

ALTER TABLE public.system_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_announcement_reads ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.system_announcements FROM PUBLIC, anon;
REVOKE ALL ON public.system_announcement_reads FROM PUBLIC, anon;
GRANT SELECT ON public.system_announcements TO authenticated;
GRANT SELECT, INSERT ON public.system_announcement_reads TO authenticated;
GRANT ALL ON public.system_announcements, public.system_announcement_reads TO service_role;

-- הקהל של הודעה כולל את המשתמש
CREATE OR REPLACE FUNCTION public.announcement_targets_me(p_audience text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  SELECT CASE p_audience
    WHEN 'all' THEN true
    WHEN 'shadchanim' THEN public.has_role(auth.uid(), 'shadchan')
    WHEN 'users' THEN NOT public.has_role(auth.uid(), 'shadchan')
    ELSE false
  END;
$function$;

ALTER FUNCTION public.announcement_targets_me(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.announcement_targets_me(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.announcement_targets_me(text) TO authenticated;

CREATE POLICY "Announcements readable by audience or admin" ON public.system_announcements
  FOR SELECT TO authenticated
  USING (public.is_admin() OR (is_active AND public.announcement_targets_me(audience)));

CREATE POLICY "Announcement reads own or admin" ON public.system_announcement_reads
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin());

CREATE POLICY "Announcement reads insert own" ON public.system_announcement_reads
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ── rollback ─────────────────────────────────────────────────────────
--   להסיר את שתי הטבלאות (reads ואז announcements) ואת announcement_targets_me(text)
