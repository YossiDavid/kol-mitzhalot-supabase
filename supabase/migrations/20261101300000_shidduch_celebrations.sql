-- חגיגת שידוכים בכניסה ל-/app: "כאשר נסגר שידוך - כולם מקבלים על זה
-- 'קונפטי' כשהם נכנסים לאתר", ו"מי שלא נכנס הרבה זמן, כשהוא ייכנס יופיע לו
-- חגיגה של מזלטים".
--
--  * user_celebration_state: לכל משתמש - עד מתי ראה חגיגה (seen_at) ומתי
--    נכנס לאחרונה (last_entry_at). last_seen_at של user_profiles לא מתאים:
--    ה-proxy מעדכן אותו לפני הרינדור, כך שהכניסה הקודמת כבר נדרסה.
--  * check_celebration(): מה להציג עכשיו - 'none' / 'new' (שידוך חדש מאז
--    החגיגה האחרונה) / 'welcome_back' (שידוכים חדשים + היעדרות ארוכה).
--    בפעם הראשונה נספרים רק שידוכים מ-7 הימים האחרונים.
--  * mark_celebration_seen(): המשתמש ראה את החגיגה.
--
-- "שידוך שנסגר" = מודעת אירוסין שנוצרה מהמערכת או בידי מנהל, או שפורסמה.
-- שורות שלא פורסמו מהטופס הציבורי אינן נספרות (פתוח לאנונימי - ספאם).
-- לא מוחזר שום פרט מזהה - רק מספר.
--
-- system_settings.celebrations_enabled = false מכבה (סביבת הבדיקות, כמו
-- terms_gate_enabled). שורה חסרה = פעיל.
--
-- אידמפוטנטית. להחלה: psql -v ON_ERROR_STOP=1 -f <file>

-- ── 1. מצב החגיגה למשתמש ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_celebration_state (
  user_id       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  seen_at       timestamptz NOT NULL,
  last_entry_at timestamptz NOT NULL
);

COMMENT ON TABLE public.user_celebration_state IS
  'חגיגת שידוכים: seen_at = עד מתי המשתמש ראה חגיגה, last_entry_at = הכניסה האחרונה ל-/app. גישה רק דרך check_celebration / mark_celebration_seen.';

-- אין מדיניות: המשתמשים ניגשים רק דרך הפונקציות (SECURITY DEFINER)
ALTER TABLE public.user_celebration_state ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.user_celebration_state FROM anon;
REVOKE ALL ON TABLE public.user_celebration_state FROM authenticated;
GRANT ALL ON TABLE public.user_celebration_state TO service_role;

-- ספירת שידוכים לפי created_at
CREATE INDEX IF NOT EXISTS engagements_created_at_idx
  ON public.engagements (created_at);

-- ── 2. מה להציג עכשיו ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_celebration()
RETURNS TABLE (kind text, new_count integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  -- בפעם הראשונה: רק שידוכים מהשבוע האחרון
  c_first_lookback CONSTANT interval := interval '7 days';
  -- היעדרות ארוכה = חגיגה גדולה
  c_long_absence CONSTANT interval := interval '30 days';
  v_uid uuid := auth.uid();
  v_state public.user_celebration_state%ROWTYPE;
  v_count integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  IF (SELECT s.value FROM public.system_settings s
      WHERE s.key = 'celebrations_enabled') IS FALSE THEN
    RETURN QUERY SELECT 'none'::text, 0;
    RETURN;
  END IF;

  SELECT * INTO v_state
  FROM public.user_celebration_state
  WHERE user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.user_celebration_state (user_id, seen_at, last_entry_at)
    VALUES (v_uid, now() - c_first_lookback, now())
    ON CONFLICT (user_id) DO NOTHING
    RETURNING * INTO v_state;
    -- כניסה מקבילה כבר יצרה את השורה
    IF v_state.user_id IS NULL THEN
      SELECT * INTO v_state
      FROM public.user_celebration_state
      WHERE user_id = v_uid;
    END IF;
  END IF;

  SELECT count(*)::integer INTO v_count
  FROM public.engagements e
  WHERE e.created_at > v_state.seen_at
    AND (e.source IN ('system', 'admin') OR e.is_published IS TRUE);

  IF v_count = 0 THEN
    UPDATE public.user_celebration_state
    SET last_entry_at = now()
    WHERE user_id = v_uid;
    RETURN QUERY SELECT 'none'::text, 0;
    RETURN;
  END IF;

  -- היעדרות ארוכה: הכניסה הקודמת לא נדרסת עד שהחגיגה נראתה, כך שרענון
  -- לפני הסגירה מציג שוב את אותה חגיגה גדולה
  IF v_state.last_entry_at < now() - c_long_absence THEN
    RETURN QUERY SELECT 'welcome_back'::text, v_count;
    RETURN;
  END IF;

  UPDATE public.user_celebration_state
  SET last_entry_at = now()
  WHERE user_id = v_uid;
  RETURN QUERY SELECT 'new'::text, v_count;
END;
$$;

ALTER FUNCTION public.check_celebration() OWNER TO postgres;

COMMENT ON FUNCTION public.check_celebration()
  IS 'למעטפת /app: איזו חגיגת שידוכים להציג (none/new/welcome_back) וכמה שידוכים חדשים. מעדכן את הכניסה האחרונה.';

REVOKE ALL ON FUNCTION public.check_celebration() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_celebration() FROM anon;
GRANT EXECUTE ON FUNCTION public.check_celebration() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_celebration() TO service_role;

-- ── 3. המשתמש ראה את החגיגה ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_celebration_seen()
RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO ''
    AS $$
  INSERT INTO public.user_celebration_state (user_id, seen_at, last_entry_at)
  SELECT auth.uid(), now(), now()
  WHERE auth.uid() IS NOT NULL
  ON CONFLICT (user_id) DO UPDATE
    SET seen_at = now(), last_entry_at = now();
$$;

ALTER FUNCTION public.mark_celebration_seen() OWNER TO postgres;

COMMENT ON FUNCTION public.mark_celebration_seen()
  IS 'המשתמש ראה את חגיגת השידוכים: עד עכשיו הכול נחגג.';

REVOKE ALL ON FUNCTION public.mark_celebration_seen() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_celebration_seen() FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_celebration_seen() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_celebration_seen() TO service_role;

NOTIFY pgrst, 'reload schema';

-- ── Rollback (להריץ ידנית) ──
-- DROP FUNCTION IF EXISTS public.mark_celebration_seen();
-- DROP FUNCTION IF EXISTS public.check_celebration();
-- DROP INDEX IF EXISTS public.engagements_created_at_idx;
-- DROP TABLE IF EXISTS public.user_celebration_state;
-- DELETE FROM public.system_settings WHERE key = 'celebrations_enabled';
