-- התראה למנהלים כשבעל כרטיס עורך את הכרטיס או משנה את התמונות שלו (תוספת
-- בלבד, בטוח להחיל לפני הקוד).
--
-- מי מפעיל: בעל הכרטיס בסשן שלו (auth.uid() = students.user_id) שאינו שדכן או
-- מנהל. עריכה של מנהל / שדכן / service role - בלי התראה. כרטיס שעוד לא אושר
-- (ממתין או נדחה) - בלי התראה: המנהל בודק אותו ממילא בתור האישור, וכך גם
-- היצירה (כרטיס חדש נוצר ממתין) אינה שולחת.
--
-- סוגים:
--   card_updated        - שינוי בפרטי הכרטיס (שורת students: שדות התוכן בלבד,
--                         לא "פעיל בשידוכים", מכסות ומונה התמונות), או שמירה של
--                         הטבלאות המקושרות (update_full_student_profile מוחקת
--                         ומכניסה אותן מחדש בכל שמירה).
--   card_photos_changed - הוספה, הסרה או שינוי סדר של תמונה (student_photos,
--                         נכתבת רק דרך set_student_photos).
-- הגבלה: התראה אחת לכל מנהל, סוג וכרטיס כל עוד הקודמת לא נקראה. שמירה אחת
-- נוגעת בכמה טבלאות ובכמה שורות, והן מתמזגות לאותה התראה.
-- התראה לעולם אינה מכשילה את השמירה (כשל נרשם כ-WARNING).
-- אידמפוטנטית. להחלה: psql --single-transaction -v ON_ERROR_STOP=1 -f <file>

-- ── 1. סוגי ההתראות ─────────────────────────────────────────────────
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check CHECK (type = ANY (ARRAY[
    'shidduch_offer'::text, 'shidduch_response'::text, 'application_reviewed'::text,
    'application_submitted'::text, 'chat_message'::text, 'photo_request_submitted'::text,
    'photo_request_reviewed'::text, 'user_registered'::text, 'shidduch_closed_notice'::text,
    'third_party_card_created'::text, 'third_party_card_approved'::text,
    'application_message'::text, 'card_report'::text,
    'card_pending_approval'::text, 'card_approved'::text, 'card_rejected'::text,
    'proposal_disclosure_opened'::text,
    -- חדש
    'card_updated'::text, 'card_photos_changed'::text
  ]));

-- ── 2. השליחה, עם ההגבלה ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_admins_owner_card_change(p_student_id uuid, p_type text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_uid  uuid := auth.uid();
  v_card record;
BEGIN
  IF v_uid IS NULL OR p_type NOT IN ('card_updated', 'card_photos_changed') THEN
    RETURN;
  END IF;

  SELECT s.id, s.user_id, s.first_name, s.last_name, s.admin_approved_at
    INTO v_card
    FROM public.students s
   WHERE s.id = p_student_id AND s.deleted_at IS NULL;

  IF NOT FOUND
     OR v_card.user_id IS DISTINCT FROM v_uid
     OR v_card.admin_approved_at IS NULL
     OR COALESCE(public.is_shadchan_or_admin(), false) THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
  SELECT
    u.id,
    p_type,
    CASE p_type WHEN 'card_photos_changed'
         THEN 'בעל כרטיס עדכן תמונות'
         ELSE 'בעל כרטיס ערך את הכרטיס' END,
    'הכרטיס של ' || COALESCE(v_card.first_name, '') || ' ' || COALESCE(v_card.last_name, '')
      || CASE p_type WHEN 'card_photos_changed'
              THEN ': בעל הכרטיס הוסיף, הסיר או החליף תמונות.'
              ELSE ': בעל הכרטיס עדכן את פרטי הכרטיס.' END,
    '/app/students/' || p_student_id,
    p_student_id
  FROM auth.users u
  WHERE public.has_role(u.id, 'admin')
    AND u.id <> v_uid
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
       WHERE n.user_id = u.id
         AND n.type = p_type
         AND n.related_id = p_student_id
         AND n.read_at IS NULL
    );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_admins_owner_card_change failed (%): %', p_type, SQLERRM;
END;
$function$;

ALTER FUNCTION public.notify_admins_owner_card_change(uuid, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.notify_admins_owner_card_change(uuid, text) FROM PUBLIC, anon, authenticated;

-- ── 3. students: שדות התוכן של הכרטיס ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_admins_owner_card_updated()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  -- מה שבעל הכרטיס ממלא בטופס. לא כאן: in_shidduchim, מכסות ההצעות,
  -- photo_count (מתעדכן מהתמונות - יש להן התראה משלהן), עמודות ההנהלה
  c_content_columns CONSTANT text[] := ARRAY[
    'first_name', 'last_name', 'nickname', 'identity_number', 'birth_date',
    'gender', 'personal_status', 'height', 'phone', 'country', 'city', 'street',
    'house', 'community', 'shtible', 'cellphone_type', 'plan_for_life',
    'head_cover_type', 'cv_url', 'about', 'parents_info', 'family_info',
    'author_info', 'institution_id', 'card_for', 'is_yeshiva', 'is_kohen',
    'willing_to_live_countries'
  ];
BEGIN
  -- דרך מהירה: רק עדכון בסשן של בעל הכרטיס
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM NEW.user_id THEN
    RETURN NEW;
  END IF;
  IF cardinality(public.activity_changed_columns(
       to_jsonb(OLD), to_jsonb(NEW), c_content_columns)) = 0 THEN
    RETURN NEW;
  END IF;
  PERFORM public.notify_admins_owner_card_change(NEW.id, 'card_updated');
  RETURN NEW;
END;
$function$;

ALTER FUNCTION public.notify_admins_owner_card_updated() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.notify_admins_owner_card_updated() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trigger_notify_admins_owner_card_updated ON public.students;
CREATE TRIGGER trigger_notify_admins_owner_card_updated
  AFTER UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.notify_admins_owner_card_updated();

-- ── 4. הטבלאות המקושרות והתמונות ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_admins_owner_card_related_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_student_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;
  IF TG_OP = 'DELETE' THEN
    v_student_id := OLD.student_id;
  ELSE
    v_student_id := NEW.student_id;
  END IF;
  PERFORM public.notify_admins_owner_card_change(
    v_student_id,
    CASE WHEN TG_TABLE_NAME = 'student_photos'
         THEN 'card_photos_changed' ELSE 'card_updated' END
  );
  RETURN NULL;
END;
$function$;

ALTER FUNCTION public.notify_admins_owner_card_related_change() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.notify_admins_owner_card_related_change() FROM PUBLIC, anon, authenticated;

-- תמונות: הוספה, הסרה, ושינוי מקום (set_student_photos כותבת position לכל
-- התמונות בכל שמירה, ולכן רק שינוי בפועל נחשב)
DROP TRIGGER IF EXISTS trigger_notify_admins_owner_photos_changed ON public.student_photos;
CREATE TRIGGER trigger_notify_admins_owner_photos_changed
  AFTER INSERT OR DELETE ON public.student_photos
  FOR EACH ROW EXECUTE FUNCTION public.notify_admins_owner_card_related_change();
DROP TRIGGER IF EXISTS trigger_notify_admins_owner_photos_reordered ON public.student_photos;
CREATE TRIGGER trigger_notify_admins_owner_photos_reordered
  AFTER UPDATE OF position ON public.student_photos
  FOR EACH ROW WHEN (OLD.position IS DISTINCT FROM NEW.position)
  EXECUTE FUNCTION public.notify_admins_owner_card_related_change();

-- הטבלאות שהטופס שומר (update_full_student_profile: מחיקה והכנסה מחדש)
DO $related$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'education_history', 'employment_history', 'medical_records',
    'partner_preferences', 'references', 'previous_partners'
  ] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trigger_notify_admins_owner_card_related ON public.%I',
      v_table);
    EXECUTE format(
      'CREATE TRIGGER trigger_notify_admins_owner_card_related
         AFTER INSERT ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.notify_admins_owner_card_related_change()',
      v_table);
  END LOOP;
END
$related$;

NOTIFY pgrst, 'reload schema';

-- ── rollback ─────────────────────────────────────────────────────────
--   DROP TRIGGER IF EXISTS trigger_notify_admins_owner_card_related ON public.education_history;
--   DROP TRIGGER IF EXISTS trigger_notify_admins_owner_card_related ON public.employment_history;
--   DROP TRIGGER IF EXISTS trigger_notify_admins_owner_card_related ON public.medical_records;
--   DROP TRIGGER IF EXISTS trigger_notify_admins_owner_card_related ON public.partner_preferences;
--   DROP TRIGGER IF EXISTS trigger_notify_admins_owner_card_related ON public."references";
--   DROP TRIGGER IF EXISTS trigger_notify_admins_owner_card_related ON public.previous_partners;
--   DROP TRIGGER IF EXISTS trigger_notify_admins_owner_photos_reordered ON public.student_photos;
--   DROP TRIGGER IF EXISTS trigger_notify_admins_owner_photos_changed ON public.student_photos;
--   DROP TRIGGER IF EXISTS trigger_notify_admins_owner_card_updated ON public.students;
--   DROP FUNCTION IF EXISTS public.notify_admins_owner_card_related_change();
--   DROP FUNCTION IF EXISTS public.notify_admins_owner_card_updated();
--   DROP FUNCTION IF EXISTS public.notify_admins_owner_card_change(uuid, text);
--   DELETE FROM public.notifications WHERE type IN ('card_updated', 'card_photos_changed');
--   -- ...ואז להחיל מחדש את notifications_type_check מ-20261026100000_proposal_disclosure_updates.sql
--   NOTIFY pgrst, 'reload schema';
