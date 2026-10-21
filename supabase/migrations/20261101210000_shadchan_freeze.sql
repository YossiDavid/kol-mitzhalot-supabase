-- הקפאת שדכן והסרת הרשאות מרשימת השדכנים של המנהל.
--
--  * shadchanim_info.frozen_at / frozen_by / frozen_reason: הקפאה הפיכה. רק
--    מנהל (או service role) משנה אותן - guard_shadchan_freeze משמר את הערכים
--    הקיימים בכל כתיבה של המשתמש עצמו, ומאפס אותם בהכנסה שלו.
--  * שדכן מוקפא מאבד את כוחות השדכן: is_shadchan() ו-is_approved_shadchan(uid)
--    מחזירות false עבורו, ולכן גם is_shadchan_or_admin() וכל מדיניות RLS שנשענת
--    עליהן. התפקיד ב-app_metadata.roles נשאר, וביטול ההקפאה מחזיר הכול.
--    רשימת השדכנים הציבורית (list_approved_shadchanim) אינה מציגה שדכן מוקפא.
--  * הסרת הרשאות: הנתיב מסיר את התפקיד shadchan ומסמן את הבקשה כ-rejected.
--    notify_application_reviewed מנסחת למעבר approved -> rejected התראה של
--    "הרשאות השדכן הוסרו" במקום "בקשתך נדחתה".
--
-- אידמפוטנטית. להחלה: psql -v ON_ERROR_STOP=1 -f <file>

-- ── 1. העמודות ───────────────────────────────────────────────────
ALTER TABLE public.shadchanim_info
  ADD COLUMN IF NOT EXISTS frozen_at timestamptz,
  ADD COLUMN IF NOT EXISTS frozen_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS frozen_reason text;

ALTER TABLE public.shadchanim_info
  DROP CONSTRAINT IF EXISTS shadchanim_info_frozen_reason_length_check;
ALTER TABLE public.shadchanim_info
  ADD CONSTRAINT shadchanim_info_frozen_reason_length_check
  CHECK (frozen_reason IS NULL OR char_length(frozen_reason) <= 1000);

COMMENT ON COLUMN public.shadchanim_info.frozen_at IS
  'מתי המנהל הקפיא את השדכן (NULL = פעיל). שדכן מוקפא אינו נחשב שדכן ב-is_shadchan / is_approved_shadchan.';
COMMENT ON COLUMN public.shadchanim_info.frozen_by IS 'המנהל שהקפיא';
COMMENT ON COLUMN public.shadchanim_info.frozen_reason IS 'סיבת ההקפאה (להנהלה ולשדכן)';

-- ── 2. רק מנהל משנה את ההקפאה ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_shadchan_freeze() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'auth'
    AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.frozen_at := NULL;
    NEW.frozen_by := NULL;
    NEW.frozen_reason := NULL;
    RETURN NEW;
  END IF;

  NEW.frozen_at := OLD.frozen_at;
  NEW.frozen_by := OLD.frozen_by;
  NEW.frozen_reason := OLD.frozen_reason;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.guard_shadchan_freeze() OWNER TO postgres;

DROP TRIGGER IF EXISTS trigger_guard_shadchan_freeze ON public.shadchanim_info;
CREATE TRIGGER trigger_guard_shadchan_freeze
  BEFORE INSERT OR UPDATE ON public.shadchanim_info
  FOR EACH ROW EXECUTE FUNCTION public.guard_shadchan_freeze();

-- ── 3. שדכן מוקפא אינו שדכן ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_shadchan_frozen(uid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shadchanim_info
    WHERE user_id = uid AND frozen_at IS NOT NULL
  );
$$;

ALTER FUNCTION public.is_shadchan_frozen(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.is_shadchan_frozen(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_shadchan_frozen(uuid) TO authenticated, service_role;

-- מ-20261007110000_security_hardening_2.sql, עם החרגת שדכן מוקפא.
-- is_shadchan_or_admin() קוראת ל-is_shadchan() ולכן מתעדכנת מעצמה.
CREATE OR REPLACE FUNCTION public.is_shadchan() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  SELECT public.has_role(auth.uid(), 'shadchan')
    AND NOT public.is_shadchan_frozen(auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_approved_shadchan(uid uuid) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  SELECT public.has_role(uid, 'shadchan')
    AND EXISTS (
      SELECT 1 FROM public.shadchanim_info
      WHERE user_id = uid AND application_status = 'approved'
        AND frozen_at IS NULL
    );
$$;

-- מ-20261021100000_contact_details_at_source.sql, עם החרגת שדכן מוקפא
CREATE OR REPLACE FUNCTION public.list_approved_shadchanim()
RETURNS TABLE(shadchan_id uuid, first_name text, last_name text, avatar_url text, since_year integer, phone text, email text, city text, description text, experience_years integer, closed_matches integer, specializations text[], languages text[])
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
           AND si.frozen_at IS NULL
           AND public.has_role(si.user_id, 'shadchan')
           AND si.user_id <> auth.uid()
       )) pp
  WHERE auth.uid() IS NOT NULL
  ORDER BY COALESCE(pp.last_name, ''), COALESCE(pp.first_name, '');
$$;

-- ── 4. התראה על הסרת הרשאות ──────────────────────────────────────
-- ההגדרה האחרונה (20260907180000_notifications.sql ואילך), עם ניסוח נפרד למעבר
-- של שדכן מאושר לנדחה (הסרת הרשאות בידי מנהל)
CREATE OR REPLACE FUNCTION public.notify_application_reviewed() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  v_kind  text;
  v_title text;
BEGIN
  IF OLD.application_status IS NOT DISTINCT FROM NEW.application_status THEN
    RETURN NEW;
  END IF;
  IF NEW.application_status NOT IN ('approved', 'rejected') THEN
    RETURN NEW;
  END IF;

  v_kind := CASE TG_TABLE_NAME
    WHEN 'shadchanim_info' THEN 'שדכן'
    ELSE 'איש צוות'
  END;

  v_title := CASE
    WHEN NEW.application_status = 'approved' THEN 'בקשתך כ' || v_kind || ' אושרה'
    WHEN TG_TABLE_NAME = 'shadchanim_info' AND OLD.application_status = 'approved'
      THEN 'הרשאות השדכן שלך הוסרו'
    ELSE 'בקשתך כ' || v_kind || ' נדחתה'
  END;

  PERFORM public.create_notification(
    NEW.user_id, 'application_reviewed',
    v_title,
    COALESCE(NEW.rejected_reason, 'ניתן לראות את הפרטים בהגדרות.'),
    '/app/settings'
  );

  RETURN NEW;
END;
$$;

-- ── Rollback (להריץ ידנית) ──
-- 1. להחזיר את is_shadchan / is_approved_shadchan להגדרות שב-20261007110000_security_hardening_2.sql,
--    את list_approved_shadchanim להגדרה שב-20261021100000_contact_details_at_source.sql,
--    ואת notify_application_reviewed להגדרה הקודמת (בלי הענף של הסרת הרשאות)
-- 2. DROP TRIGGER IF EXISTS trigger_guard_shadchan_freeze ON public.shadchanim_info;
--    DROP FUNCTION IF EXISTS public.guard_shadchan_freeze(); DROP FUNCTION IF EXISTS public.is_shadchan_frozen(uuid);
-- 3. ALTER TABLE public.shadchanim_info DROP COLUMN IF EXISTS frozen_at,
--      DROP COLUMN IF EXISTS frozen_by, DROP COLUMN IF EXISTS frozen_reason;
