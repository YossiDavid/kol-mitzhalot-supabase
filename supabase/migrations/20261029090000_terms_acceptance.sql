-- אישור תקנון: כל משתמש (חדש וקיים) חייב לאשר את התקנון כדי להשתמש במערכת,
-- וגם לאשר מחדש כשהמנהל מפרסם גרסה חדשה.
--
--  * system_content.version: גרסת התוכן שפורסמה. 0 = לא נדרש אישור. שמירת
--    תוכן רגילה (תיקון ניסוח) לא משנה את הגרסה; רק הפעולה המפורשת של המנהל
--    "פרסום גרסה חדשה" (publish_system_content_version) מעלה אותה ומחייבת
--    את כולם לאשר מחדש. התקנון מתחיל בגרסה 1 - כך שגם משתמשים קיימים יידרשו
--    לאשר אותו בכניסה הבאה.
--  * terms_acceptances: מי אישר איזו גרסה ומתי. הכנסה - רק לעצמי ורק לגרסה
--    הנוכחית (RLS). קריאה - לעצמי ולמנהל. אין עדכון ואין מחיקה למשתמשים.
--  * get_terms_gate_status: שאילתה אחת קטנה למעטפת /app - הגרסה הנדרשת
--    והגרסה האחרונה שהמשתמש אישר. system_settings.terms_gate_enabled = false
--    מכבה את החסימה (לסביבת הבדיקות בלבד, כמו phone_verification_enabled);
--    בלי השורה - החסימה פעילה.
--
-- אידמפוטנטית. להחלה: psql -v ON_ERROR_STOP=1 -f <file>

-- ── 1. גרסת התוכן ─────────────────────────────────────────────────
ALTER TABLE public.system_content
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 0;

ALTER TABLE public.system_content
  DROP CONSTRAINT IF EXISTS system_content_version_check;
ALTER TABLE public.system_content
  ADD CONSTRAINT system_content_version_check CHECK (version >= 0);

COMMENT ON COLUMN public.system_content.version IS
  'גרסה שפורסמה. 0 = לא נדרש אישור. עולה רק בפעולת "פרסום גרסה חדשה" של מנהל - ומחייבת אישור מחדש.';

-- התקנון מתחיל בגרסה 1 (רק אם עוד לא פורסמה גרסה)
UPDATE public.system_content
SET version = 1
WHERE key = 'terms-of-service' AND version = 0;

-- שמירת תוכן רגילה (upsert מהעורך) לא נוגעת בגרסה: מי שאינו עובר דרך
-- publish_system_content_version לא יכול לשנות אותה.
CREATE OR REPLACE FUNCTION public.guard_system_content_version() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF COALESCE(current_setting('app.publishing_content_version', true), '') <> 'on' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.version := CASE WHEN NEW.key = 'terms-of-service' THEN 1 ELSE 0 END;
    ELSE
      NEW.version := OLD.version;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.guard_system_content_version() OWNER TO postgres;

DROP TRIGGER IF EXISTS trigger_guard_system_content_version ON public.system_content;
CREATE TRIGGER trigger_guard_system_content_version
  BEFORE INSERT OR UPDATE ON public.system_content
  FOR EACH ROW EXECUTE FUNCTION public.guard_system_content_version();

-- ── 2. פרסום גרסה חדשה (מנהל בלבד) ───────────────────────────────
CREATE OR REPLACE FUNCTION public.publish_system_content_version(p_key text)
RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_version integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('app.publishing_content_version', 'on', true);

  UPDATE public.system_content
  SET version = version + 1
  WHERE key = p_key
  RETURNING version INTO v_version;

  PERFORM set_config('app.publishing_content_version', '', true);

  IF v_version IS NULL THEN
    RAISE EXCEPTION 'content_not_found' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_version;
END;
$$;

ALTER FUNCTION public.publish_system_content_version(text) OWNER TO postgres;

COMMENT ON FUNCTION public.publish_system_content_version(text)
  IS 'מנהל בלבד: מעלה את גרסת התוכן ב-1. לתקנון - מחייב את כל המשתמשים לאשר מחדש.';

REVOKE ALL ON FUNCTION public.publish_system_content_version(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.publish_system_content_version(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.publish_system_content_version(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_system_content_version(text) TO service_role;

-- ── 3. אישורי התקנון ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.terms_acceptances (
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version     integer NOT NULL CHECK (version >= 1),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, version)
);

COMMENT ON TABLE public.terms_acceptances IS
  'אישורי תקנון: מי אישר איזו גרסה (system_content.version של terms-of-service) ומתי.';

ALTER TABLE public.terms_acceptances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "terms_acceptances_select_own_or_admin" ON public.terms_acceptances;
CREATE POLICY "terms_acceptances_select_own_or_admin" ON public.terms_acceptances
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

-- הכנסה לעצמי בלבד, ורק לגרסה שפורסמה עכשיו - אי אפשר "לאשר מראש" גרסה עתידית
DROP POLICY IF EXISTS "terms_acceptances_insert_own_current" ON public.terms_acceptances;
CREATE POLICY "terms_acceptances_insert_own_current" ON public.terms_acceptances
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND version = (
      SELECT sc.version FROM public.system_content sc
      WHERE sc.key = 'terms-of-service'
    )
  );

REVOKE ALL ON TABLE public.terms_acceptances FROM anon;
GRANT SELECT, INSERT ON TABLE public.terms_acceptances TO authenticated;
GRANT ALL ON TABLE public.terms_acceptances TO service_role;

-- ── 4. מצב החסימה למשתמש המחובר ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_terms_gate_status()
RETURNS TABLE (required_version integer, accepted_version integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT
    CASE
      WHEN (SELECT s.value FROM public.system_settings s
            WHERE s.key = 'terms_gate_enabled') IS FALSE THEN 0
      ELSE COALESCE((SELECT sc.version FROM public.system_content sc
                     WHERE sc.key = 'terms-of-service'), 0)
    END,
    COALESCE((SELECT max(ta.version) FROM public.terms_acceptances ta
              WHERE ta.user_id = auth.uid()), 0)
  WHERE auth.uid() IS NOT NULL;
$$;

ALTER FUNCTION public.get_terms_gate_status() OWNER TO postgres;

COMMENT ON FUNCTION public.get_terms_gate_status()
  IS 'למעטפת /app: גרסת התקנון הנדרשת (0 = אין חסימה) והגרסה האחרונה שהמשתמש המחובר אישר.';

REVOKE ALL ON FUNCTION public.get_terms_gate_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_terms_gate_status() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_terms_gate_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_terms_gate_status() TO service_role;

-- ── Rollback (להריץ ידנית) ──
-- DROP FUNCTION IF EXISTS public.get_terms_gate_status();
-- DROP TABLE IF EXISTS public.terms_acceptances;
-- DROP FUNCTION IF EXISTS public.publish_system_content_version(text);
-- DROP TRIGGER IF EXISTS trigger_guard_system_content_version ON public.system_content;
-- DROP FUNCTION IF EXISTS public.guard_system_content_version();
-- ALTER TABLE public.system_content DROP CONSTRAINT IF EXISTS system_content_version_check;
-- ALTER TABLE public.system_content DROP COLUMN IF EXISTS version;
