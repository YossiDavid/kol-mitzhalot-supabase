-- תיקוני התראות ומיילים:
--   1. השולח לא מקבל התראה על ההצעה/שינוי הסטטוס של עצמו.
--   2. שליחה לצד השני (הרחבת recipient_scope) מייצרת התראה גם לצד השני.
--   3. התראה למנהלים על כל הרשמה חדשה (+ סימון להודעת מייל מקוד שרת).
--   4. עדכון הצד השני שההצעה ירדה מהפרק - טבלת תיעוד ופונקציית שליחה.
--
-- ה-CHECK על notifications.type נבנה מחדש במלואו (אין ALTER CONSTRAINT ל-CHECK).
-- הרשימה הקודמת: 20260908140000_photo_view_requests.sql.
--
-- אידמפוטנטית - ניתן להריץ שוב.

-- ── 0. סוגי התראה ─────────────────────────────────────────────────
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'shidduch_offer',
    'shidduch_response',
    'application_reviewed',
    'application_submitted',
    'chat_message',
    'photo_request_submitted',
    'photo_request_reviewed',
    'user_registered',
    'shidduch_closed_notice'
  ));

-- ── 1+2. התראת הצעה: בלי השולח, ועם הרחבת היקף ────────────────────
-- (א) נמען ששווה ל-shadchan_id מדולג: שדכן/מנהל שהוא גם בעל כרטיס באחד
--     הצדדים קיבל "הצעה התקבלה" על הצעה שהוא עצמו שלח.
-- (ב) send-other-side מעדכן sent_at בשורה שכבר נשלחה והופך את ההיקף
--     ל-both. עד כה הטריגר חזר מוקדם (OLD.sent_at לא ריק) והצד השני קיבל
--     מייל בלי התראה. עכשיו מתריעים לכל צד שנכנס להיקף ולא היה בו קודם.
--     הטריגר מאזין גם ל-recipient_scope, כדי לא להיות תלוי בכך שהקוד
--     עדכן במפורש את sent_at.
-- (ג) בעל כרטיס ששני הצדדים שלו מקבל התראה אחת, כמו במייל.
CREATE OR REPLACE FUNCTION public.notify_shidduch_offer_sent() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  v_new_scope    text;
  v_old_scope    text;
  v_groom_user   uuid;
  v_bride_user   uuid;
  v_notify_groom boolean;
  v_notify_bride boolean;
BEGIN
  IF NEW.sent_at IS NULL THEN
    RETURN NEW;
  END IF;

  v_new_scope := COALESCE(NEW.recipient_scope, 'both');
  -- שורה שכבר נשלחה: ההיקף הקודם. שליחה ראשונה (או חוזרת אחרי גלגול
  -- אחורה, כש-sent_at חזר ל-NULL): אין צד שכבר קיבל.
  IF TG_OP = 'UPDATE' AND OLD.sent_at IS NOT NULL THEN
    v_old_scope := COALESCE(OLD.recipient_scope, 'both');
  END IF;

  v_notify_groom := v_new_scope IN ('both', 'groom_only')
    AND (v_old_scope IS NULL OR v_old_scope NOT IN ('both', 'groom_only'));
  v_notify_bride := v_new_scope IN ('both', 'bride_only')
    AND (v_old_scope IS NULL OR v_old_scope NOT IN ('both', 'bride_only'));

  IF NOT v_notify_groom AND NOT v_notify_bride THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO v_groom_user FROM public.students WHERE id = NEW.groom_id;
  SELECT user_id INTO v_bride_user FROM public.students WHERE id = NEW.bride_id;

  IF v_notify_groom AND v_groom_user IS DISTINCT FROM NEW.shadchan_id THEN
    PERFORM public.create_notification(
      v_groom_user, 'shidduch_offer',
      'הצעת שידוך חדשה',
      'התקבלה עבורכם הצעת שידוך חדשה.',
      '/app/proposals'
    );
  END IF;

  IF v_notify_bride
     AND v_bride_user IS DISTINCT FROM NEW.shadchan_id
     AND NOT (v_notify_groom AND v_bride_user IS NOT DISTINCT FROM v_groom_user) THEN
    PERFORM public.create_notification(
      v_bride_user, 'shidduch_offer',
      'הצעת שידוך חדשה',
      'התקבלה עבורכם הצעת שידוך חדשה.',
      '/app/proposals'
    );
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.notify_shidduch_offer_sent() OWNER TO postgres;

DROP TRIGGER IF EXISTS trigger_notify_shidduch_offer_sent ON public.shidduchim;
CREATE TRIGGER trigger_notify_shidduch_offer_sent
  AFTER INSERT OR UPDATE OF sent_at, recipient_scope ON public.shidduchim
  FOR EACH ROW EXECUTE FUNCTION public.notify_shidduch_offer_sent();

-- ── 1ב. מי שינה את הסטטוס ─────────────────────────────────────────
-- PATCH /api/v1/shidduchim/status כותב עם service role, ולכן auth.uid()
-- הוא NULL והשדכן קיבל התראה על העריכה הידנית של עצמו. הפתרון: הקוד קורא
-- ל-set_shidduch_status_as, שמציבה את המבצע ב-set_config מקומי לטרנזקציה
-- ואז מעדכנת; הטריגר משווה את המבצע ל-shadchan_id.
-- למה לא לעדכן דרך סשן המשתמש: זה תלוי במדיניות UPDATE על shidduchim
-- (שדכן/מנהל) ויישבר בשקט אם תשתנה, וגם לא פותר מנהל שעורך הצעה של אחר.
CREATE OR REPLACE FUNCTION public.set_shidduch_status_as(
  p_shidduch_id uuid,
  p_status      text,
  p_actor       uuid
) RETURNS TABLE (out_id uuid, out_status text, out_updated_at timestamptz)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
BEGIN
  PERFORM set_config('app.shidduch_actor', COALESCE(p_actor::text, ''), true);

  UPDATE public.shidduchim sh
     SET status     = p_status::public.shidduch_status_enum,
         updated_at = now()
   WHERE sh.id = p_shidduch_id
  RETURNING sh.id, sh.status::text, sh.updated_at
  INTO out_id, out_status, out_updated_at;

  PERFORM set_config('app.shidduch_actor', '', true);

  -- שורה אחת אם השידוך נמצא, ריק אם לא
  IF out_id IS NOT NULL THEN
    RETURN NEXT;
  END IF;
END;
$$;

ALTER FUNCTION public.set_shidduch_status_as(uuid, text, uuid) OWNER TO postgres;

COMMENT ON FUNCTION public.set_shidduch_status_as(uuid, text, uuid)
  IS 'עדכון סטטוס שידוך מקוד שרת (service role) עם זהות המבצע, כדי שהטריגר לא יתריע לשדכן על שינוי של עצמו. p_actor לא נבדק כאן - הקורא (route) אחראי להרשאה, ולכן הגישה לשרת בלבד.';

REVOKE ALL ON FUNCTION public.set_shidduch_status_as(uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_shidduch_status_as(uuid, text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.set_shidduch_status_as(uuid, text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.set_shidduch_status_as(uuid, text, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.notify_shidduch_response() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  v_label text;
  v_actor uuid;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF current_setting('app.shidduch_status_source', true) = 'parent_response' THEN
    RETURN NEW;
  END IF;

  -- המבצע: המשתמש המחובר (סשן רגיל), ובכתיבה מקוד שרת - מה שהקורא הציב
  -- ב-set_shidduch_status_as. אם הוא השדכן עצמו אין טעם להתריע לו.
  v_actor := COALESCE(
    auth.uid(),
    NULLIF(current_setting('app.shidduch_actor', true), '')::uuid
  );
  IF v_actor IS NOT DISTINCT FROM NEW.shadchan_id THEN
    RETURN NEW;
  END IF;

  v_label := CASE NEW.status::text
    WHEN 'interested'       THEN 'יש עניין בהצעה'
    WHEN 'more_info_needed' THEN 'התבקש מידע נוסף'
    WHEN 'rejected'         THEN 'ההצעה נדחתה'
    ELSE NULL
  END;

  IF v_label IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.create_notification(
    NEW.shadchan_id, 'shidduch_response',
    v_label,
    'התקבלה תגובה להצעת שידוך ששלחת.',
    '/app/shidduchim/' || NEW.id::text
  );

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.notify_shidduch_response() OWNER TO postgres;

-- ── 3. הרשמה חדשה → מנהלים ────────────────────────────────────────
-- סימון מייל: שורה לכל משתמש חדש, שנוצרת בטריגר ההרשמה. קוד השרת
-- (/auth/confirm) תופס אותה אטומית לפני שליחת המייל למנהלים ומסמן
-- sent_at אחרי שליחה, כך שכל משתמש מפעיל לכל היותר מייל אחד גם בכניסות
-- חוזרות ובמקביל. טריגר DB לא יכול לשלוח מייל, ואין כאן webhook.
CREATE TABLE IF NOT EXISTS public.signup_admin_notifications (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- תפיסה בתוקף = מישהו שולח כרגע; מתפוגגת בקוד אם התהליך קרס
  claimed_at timestamptz,
  sent_at    timestamptz
);

COMMENT ON TABLE public.signup_admin_notifications
  IS 'סימון אידמפוטנטי למייל "משתמש חדש" למנהלים. שורה ללא sent_at = עדיין לא נשלח. נכתבת בטריגר ומנוהלת מקוד שרת בלבד.';

-- משתמשים קיימים סומנו כנשלחו, כדי שהכניסה הבאה שלהם לא תפעיל מייל
INSERT INTO public.signup_admin_notifications (user_id, created_at, sent_at)
SELECT u.id, now(), now() FROM auth.users u
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE public.signup_admin_notifications ENABLE ROW LEVEL SECURITY;
-- אין מדיניות בכוונה: גישה רק ל-service role (עוקף RLS)
REVOKE ALL ON TABLE public.signup_admin_notifications FROM anon;
REVOKE ALL ON TABLE public.signup_admin_notifications FROM authenticated;
GRANT ALL ON TABLE public.signup_admin_notifications TO service_role;

-- מיילי המנהלים לשליחת מייל מקוד שרת. אותו פרדיקט כמו has_role('admin').
CREATE OR REPLACE FUNCTION public.get_admin_emails() RETURNS TABLE (email text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  SELECT u.email::text
  FROM auth.users u
  WHERE u.email IS NOT NULL
    AND ((u.raw_user_meta_data->'roles' ? 'admin')
      OR (u.raw_user_meta_data->>'role' = 'admin'));
$$;

ALTER FUNCTION public.get_admin_emails() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_admin_emails() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_admin_emails() FROM anon;
REVOKE ALL ON FUNCTION public.get_admin_emails() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_emails() TO service_role;

-- הטריגר לעולם לא חוסם הרשמה: כל חלק עטוף במטפל חריגים נפרד, כך שכשל
-- בהתראה (או בסימון) לא מפיל את ה-INSERT ל-auth.users.
CREATE OR REPLACE FUNCTION public.notify_admins_user_registered() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  v_name text;
BEGIN
  BEGIN
    INSERT INTO public.signup_admin_notifications (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_admins_user_registered: marker failed: %', SQLERRM;
  END;

  BEGIN
    v_name := NULLIF(BTRIM(
      COALESCE(NULLIF(BTRIM(COALESCE(NEW.raw_user_meta_data->>'firstName', NEW.raw_user_meta_data->>'first_name', '')), ''), '')
      || ' ' ||
      COALESCE(NULLIF(BTRIM(COALESCE(NEW.raw_user_meta_data->>'lastName', NEW.raw_user_meta_data->>'last_name', '')), ''), '')
    ), '');

    -- כל המנהלים (אותו פרדיקט כמו notify_admins_application_submitted)
    INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
    SELECT
      u.id,
      'user_registered',
      'משתמש חדש נרשם',
      left(COALESCE(v_name, 'ללא שם') || ' (' || COALESCE(NEW.email, 'ללא אימייל') || ')', 300),
      '/app/admin/users/' || NEW.id::text,
      NEW.id
    FROM auth.users u
    WHERE u.id <> NEW.id
      AND ((u.raw_user_meta_data->'roles' ? 'admin')
        OR (u.raw_user_meta_data->>'role' = 'admin'));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_admins_user_registered: notification failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.notify_admins_user_registered() OWNER TO postgres;

COMMENT ON FUNCTION public.notify_admins_user_registered()
  IS 'מתריע לכל המנהלים על משתמש חדש ויוצר סימון למייל. לעולם לא חוסם הרשמה.';

DROP TRIGGER IF EXISTS trigger_notify_admins_user_registered ON auth.users;
CREATE TRIGGER trigger_notify_admins_user_registered
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.notify_admins_user_registered();

-- ── 4. עדכון הצד השני שההצעה ירדה מהפרק ───────────────────────────
-- הלקוח החליט: לא אוטומטי. השדכן בוחר ניסוח ושולח. הטבלה מתעדת מי, מתי,
-- לאיזה צד ומה נשלח.
CREATE TABLE IF NOT EXISTS public.shidduch_closed_notices (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shidduch_id       uuid NOT NULL REFERENCES public.shidduchim(id) ON DELETE CASCADE,
  side              text NOT NULL CHECK (side IN ('groom', 'bride')),
  message           text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 500),
  sent_by           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  -- נקבע מקוד השרת אחרי שהמייל באמת יצא; NULL = לא נשלח מייל (נכשל או פיתוח)
  email_sent_at     timestamptz
);

COMMENT ON TABLE public.shidduch_closed_notices
  IS 'הודעות שהשדכן שלח לצד שלא דחה שההצעה ירדה מהפרק. נכתבת רק דרך send_shidduch_closed_notice.';

CREATE INDEX IF NOT EXISTS idx_shidduch_closed_notices_shidduch
  ON public.shidduch_closed_notices (shidduch_id, created_at DESC);

ALTER TABLE public.shidduch_closed_notices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Closed notices select shadchan or admin" ON public.shidduch_closed_notices;
CREATE POLICY "Closed notices select shadchan or admin" ON public.shidduch_closed_notices
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shidduchim sh
      WHERE sh.id = shidduch_closed_notices.shidduch_id
        AND sh.shadchan_id = (SELECT auth.uid())
    )
    OR public.is_admin()
  );

-- אין INSERT/UPDATE/DELETE ללקוח: כתיבה רק דרך הפונקציה (SECURITY DEFINER)
REVOKE ALL ON TABLE public.shidduch_closed_notices FROM anon;
REVOKE ALL ON TABLE public.shidduch_closed_notices FROM authenticated;
GRANT SELECT ON TABLE public.shidduch_closed_notices TO authenticated;
GRANT ALL ON TABLE public.shidduch_closed_notices TO service_role;

-- שליחה: הרשאה (שדכן ההצעה או מנהל, לפי auth.uid()), בדיקה שהצד אכן קיבל
-- את ההצעה, תיעוד והתראה בפעמון - הכול בטרנזקציה אחת. המייל נשלח אחר כך
-- מקוד השרת, עם הנמען שמוחזר מכאן.
CREATE OR REPLACE FUNCTION public.send_shidduch_closed_notice(
  p_shidduch_id uuid,
  p_side        text,
  p_message     text
) RETURNS TABLE (notice_id uuid, recipient_user_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_sh        public.shidduchim%ROWTYPE;
  v_message   text := NULLIF(BTRIM(p_message), '');
  v_recipient uuid;
  v_notice    uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '28000';
  END IF;
  IF p_side IS NULL OR p_side NOT IN ('groom', 'bride') THEN
    RAISE EXCEPTION 'invalid_side' USING ERRCODE = '22023';
  END IF;
  IF v_message IS NULL THEN
    RAISE EXCEPTION 'message_required' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_message) > 500 THEN
    RAISE EXCEPTION 'message_too_long' USING ERRCODE = '22001';
  END IF;

  SELECT * INTO v_sh FROM public.shidduchim WHERE id = p_shidduch_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'shidduch_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_sh.shadchan_id IS DISTINCT FROM v_uid AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_shadchan' USING ERRCODE = '42501';
  END IF;

  -- הצד חייב להיות נמען בפועל (כמו respond_to_shidduch): אי אפשר
  -- "לעדכן" צד שההצעה מעולם לא נשלחה אליו.
  IF v_sh.status = 'draft'
     OR v_sh.recipient_scope IS NULL
     OR v_sh.recipient_scope NOT IN ('both', p_side || '_only') THEN
    RAISE EXCEPTION 'side_not_recipient' USING ERRCODE = '42501';
  END IF;

  v_recipient := public.shidduch_side_owner(v_sh.id, p_side);
  IF v_recipient IS NULL THEN
    RAISE EXCEPTION 'recipient_not_found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.shidduch_closed_notices (shidduch_id, side, message, sent_by, recipient_user_id)
  VALUES (v_sh.id, p_side, v_message, v_uid, v_recipient)
  RETURNING id INTO v_notice;

  -- שדכן שהוא גם בעל הכרטיס בצד היעד לא מקבל התראה על הודעה של עצמו
  IF v_recipient IS DISTINCT FROM v_uid THEN
    INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
    VALUES (v_recipient, 'shidduch_closed_notice', 'עדכון בנוגע להצעת שידוך',
            v_message, '/app/proposals', v_sh.id);
  END IF;

  RETURN QUERY SELECT v_notice, v_recipient;
END;
$$;

ALTER FUNCTION public.send_shidduch_closed_notice(uuid, text, text) OWNER TO postgres;

COMMENT ON FUNCTION public.send_shidduch_closed_notice(uuid, text, text)
  IS 'שדכן ההצעה (או מנהל) מעדכן צד שקיבל את ההצעה שהיא ירדה מהפרק: תיעוד + התראה בפעמון. מחזיר את הנמען לשליחת מייל מקוד השרת.';

REVOKE ALL ON FUNCTION public.send_shidduch_closed_notice(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.send_shidduch_closed_notice(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.send_shidduch_closed_notice(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_shidduch_closed_notice(uuid, text, text) TO service_role;
