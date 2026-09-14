-- גלריית תמונות למיועדים, במקום תמונה בודדת ב-students.image_url.
--
-- רקע: image_url החזיק signed URL בתוקף לשנה. כל select("*") על students
-- (רשימת המיועדים, לוח העבודה, המועדפים) החזיר אותו לשדכנים ולאנשי צוות -
-- גם של בנות - ומי שמחזיק את הכתובת רואה את התמונה בלי קשר ל-
-- can_view_student_photo. כאן:
--   • student_photos - נתיבי אחסון בלבד ובסדר קבוע (הראשונה = הראשית).
--     סגורה ללקוחות: השרת קורא אותה ב-service role וחותם קישור קצר רק אחרי
--     בדיקת ההרשאה.
--   • students.photo_count - כמה תמונות יש (לאייקון ברשימה ולמנעול), בלי
--     לחשוף נתיבים או קישורים.
--   • set_student_photos - הדרך היחידה לשנות את הגלריה.
--   • העברת התמונות הקיימות מ-image_url, ואיפוס image_url.
--
-- אידמפוטנטית - ניתן להריץ שוב.

-- ── 0. ה-bucket והמדיניות שלו ─────────────────────────────────────
-- בפרודקשן נוצרו ידנית ולא במיגרציה, ולכן סביבה מקומית/CI נשארה בלעדיהם.
-- מקובעים כאן בנוסח הזהה לפרודקשן, ורק אם אינם קיימים - בלי לגעת בקיים.
INSERT INTO storage.buckets (id, name, public)
VALUES ('students', 'students', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can read student files') THEN
    CREATE POLICY "Users can read student files" ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id = 'students' AND (
        (storage.foldername(name))[1] = auth.uid()::text
        OR EXISTS (SELECT 1 FROM public.students
                   WHERE students.id::text = (storage.foldername(objects.name))[1]
                     AND students.user_id = auth.uid())));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can upload files to student folders') THEN
    CREATE POLICY "Users can upload files to student folders" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'students' AND (
        (storage.foldername(name))[1] = auth.uid()::text
        OR EXISTS (SELECT 1 FROM public.students
                   WHERE students.id::text = (storage.foldername(objects.name))[1]
                     AND students.user_id = auth.uid())));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can update student files') THEN
    CREATE POLICY "Users can update student files" ON storage.objects
      FOR UPDATE TO authenticated
      USING (bucket_id = 'students' AND (
        (storage.foldername(name))[1] = auth.uid()::text
        OR EXISTS (SELECT 1 FROM public.students
                   WHERE students.id::text = (storage.foldername(objects.name))[1]
                     AND students.user_id = auth.uid())))
      WITH CHECK (bucket_id = 'students' AND (
        (storage.foldername(name))[1] = auth.uid()::text
        OR EXISTS (SELECT 1 FROM public.students
                   WHERE students.id::text = (storage.foldername(objects.name))[1]
                     AND students.user_id = auth.uid())));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can delete student files') THEN
    CREATE POLICY "Users can delete student files" ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = 'students' AND (
        (storage.foldername(name))[1] = auth.uid()::text
        OR EXISTS (SELECT 1 FROM public.students
                   WHERE students.id::text = (storage.foldername(objects.name))[1]
                     AND students.user_id = auth.uid())));
  END IF;
END $$;

-- ── 1. הטבלה ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.student_photos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  position     integer NOT NULL CHECK (position >= 0),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, storage_path),
  -- נתיב בתוך התיקייה של הכרטיס בלבד
  CHECK (storage_path LIKE student_id::text || '/%' AND storage_path NOT LIKE '%..%')
);

COMMENT ON TABLE  public.student_photos              IS 'גלריית התמונות של כרטיס מיועד. נתיבים ב-bucket students בלבד (לא קישורים). סגורה ללקוחות - השרת חותם קישורים אחרי can_view_student_photo. נכתבת רק דרך set_student_photos';
COMMENT ON COLUMN public.student_photos.storage_path IS 'נתיב ב-bucket students, בתוך התיקייה של הכרטיס';
COMMENT ON COLUMN public.student_photos.position     IS 'סדר התצוגה. 0 = התמונה הראשית';

CREATE INDEX IF NOT EXISTS idx_student_photos_student_position
  ON public.student_photos (student_id, position);

ALTER TABLE public.student_photos ENABLE ROW LEVEL SECURITY;
-- אין מדיניות ללקוחות בכוונה: גם נתיב בלבד אינו מיועד לדפדפן של מי שאינו מורשה.
REVOKE ALL ON TABLE public.student_photos FROM anon;
REVOKE ALL ON TABLE public.student_photos FROM authenticated;
GRANT ALL ON TABLE public.student_photos TO service_role;

-- ── 2. מונה התמונות על הכרטיס ─────────────────────────────────────
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS photo_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.students.photo_count IS 'מספר התמונות בגלריה (student_photos). מתעדכן בטריגר - לתצוגת "יש תמונה" בלי לחשוף את התמונות';

CREATE OR REPLACE FUNCTION public.sync_student_photo_count() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_student_id uuid := COALESCE(NEW.student_id, OLD.student_id);
BEGIN
  UPDATE public.students
  SET photo_count = (SELECT count(*) FROM public.student_photos p WHERE p.student_id = v_student_id)
  WHERE id = v_student_id;
  RETURN NULL;
END;
$$;

ALTER FUNCTION public.sync_student_photo_count() OWNER TO postgres;

DROP TRIGGER IF EXISTS trigger_sync_student_photo_count ON public.student_photos;
CREATE TRIGGER trigger_sync_student_photo_count
  AFTER INSERT OR DELETE ON public.student_photos
  FOR EACH ROW EXECUTE FUNCTION public.sync_student_photo_count();

-- ── 3. העברת התמונות הקיימות ──────────────────────────────────────
-- image_url נשמר כ-.../object/sign/students/<path>?token=... - הנתיב מחולץ
-- ממנו. רק נתיב בתוך התיקייה של אותו כרטיס מועבר.
WITH legacy AS (
  SELECT s.id, substring(s.image_url FROM '/object/sign/students/([^?]+)') AS path
  FROM public.students s
  WHERE s.image_url IS NOT NULL
)
INSERT INTO public.student_photos (student_id, storage_path, position)
SELECT legacy.id, legacy.path, 0
FROM legacy
WHERE legacy.path LIKE legacy.id::text || '/%'
  AND legacy.path NOT LIKE '%..%'
ON CONFLICT (student_id, storage_path) DO NOTHING;

-- הקישור החתום כבר לא נחוץ, ואסור שימשיך להגיע ב-select("*").
UPDATE public.students s
SET image_url = NULL
WHERE s.image_url IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.student_photos p WHERE p.student_id = s.id);

-- סנכרון המונה גם לשורות שהועברו לפני שהטריגר היה קיים (הרצה חוזרת)
UPDATE public.students s
SET photo_count = sub.cnt
FROM (SELECT student_id, count(*) AS cnt FROM public.student_photos GROUP BY student_id) sub
WHERE sub.student_id = s.id AND s.photo_count <> sub.cnt;

-- ── 4. שמירת הגלריה ───────────────────────────────────────────────
-- מקבלת את רשימת הנתיבים המלאה בסדר הרצוי ומחליפה בה את הגלריה. מחזירה
-- את הנתיבים שהוסרו, כדי שהלקוח ימחק אותם מהאחסון.
-- הרשאה: זהה ל-update_full_student_profile (בעל הכרטיס / שדכן / מנהל).
-- נתיב חדש חייב להיות תחת <student_id>/photos/; נתיב שכבר בגלריה מותר
-- תמיד (תמונות שהועברו מ-image_url יושבות ישירות בתיקיית הכרטיס).
CREATE OR REPLACE FUNCTION public.set_student_photos(p_student_id uuid, p_paths text[]) RETURNS text[]
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  c_max_photos CONSTANT integer := 6;
  v_uid        uuid := auth.uid();
  v_owner_id   uuid;
  v_paths      text[] := COALESCE(p_paths, '{}');
  v_path       text;
  v_removed    text[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING HINT = 'שמירת תמונות דורשת התחברות';
  END IF;

  SELECT s.user_id INTO v_owner_id
  FROM public.students s
  WHERE s.id = p_student_id AND s.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'student_not_found' USING HINT = 'הכרטיס לא נמצא';
  END IF;
  IF v_owner_id IS DISTINCT FROM v_uid AND NOT public.is_shadchan_or_admin() THEN
    RAISE EXCEPTION 'not_allowed' USING HINT = 'אין הרשאה לעדכן את תמונות הכרטיס';
  END IF;
  -- מי שאינו רשאי לראות את התמונות (בת, בלי אישור צפייה) אינו רשאי גם
  -- לסדר, להסיר או להחליף אותן. בעלים ומנהל תמיד רשאים לראות.
  IF NOT public.can_view_student_photo(v_uid, p_student_id) THEN
    RAISE EXCEPTION 'not_allowed' USING HINT = 'אין הרשאה לעדכן תמונות שאינך רשאי לצפות בהן';
  END IF;
  IF cardinality(v_paths) > c_max_photos THEN
    RAISE EXCEPTION 'too_many_photos' USING HINT = format('ניתן לשמור עד %s תמונות', c_max_photos);
  END IF;
  IF (SELECT count(DISTINCT x) FROM unnest(v_paths) AS x) <> cardinality(v_paths) THEN
    RAISE EXCEPTION 'duplicate_photo' USING HINT = 'אותה תמונה הופיעה פעמיים';
  END IF;

  FOREACH v_path IN ARRAY v_paths LOOP
    IF v_path IS NULL OR v_path LIKE '%..%' OR NOT (
         v_path LIKE p_student_id::text || '/photos/%'
      OR EXISTS (SELECT 1 FROM public.student_photos p
                 WHERE p.student_id = p_student_id AND p.storage_path = v_path)
    ) THEN
      RAISE EXCEPTION 'invalid_photo_path' USING HINT = 'נתיב תמונה לא תקין';
    END IF;
  END LOOP;

  SELECT COALESCE(array_agg(p.storage_path), '{}') INTO v_removed
  FROM public.student_photos p
  WHERE p.student_id = p_student_id
    AND NOT (p.storage_path = ANY (v_paths));

  DELETE FROM public.student_photos p
  WHERE p.student_id = p_student_id
    AND NOT (p.storage_path = ANY (v_paths));

  INSERT INTO public.student_photos (student_id, storage_path, position)
  SELECT p_student_id, x.path, (x.ord - 1)::integer
  FROM unnest(v_paths) WITH ORDINALITY AS x(path, ord)
  ON CONFLICT (student_id, storage_path) DO UPDATE SET position = EXCLUDED.position;

  RETURN v_removed;
END;
$$;

ALTER FUNCTION public.set_student_photos(uuid, text[]) OWNER TO postgres;

COMMENT ON FUNCTION public.set_student_photos(uuid, text[])
  IS 'מחליף את גלריית הכרטיס ברשימת הנתיבים (לפי הסדר; הראשון = הראשית). מחזיר את הנתיבים שהוסרו. בעלים/שדכן/מנהל.';

REVOKE ALL ON FUNCTION public.set_student_photos(uuid, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_student_photos(uuid, text[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_student_photos(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_student_photos(uuid, text[]) TO service_role;

-- ── 5. image_url הוצא משימוש ────────────────────────────────────────
-- create_full_student_profile ו-update_full_student_profile עדיין כותבים את
-- payload->>'image_url' כמו שהוא, ובעל הכרטיס רשאי לעדכן את השורה גם ישירות.
-- בלי הטריגר, ערך שרירותי היה חוזר לזרום ב-select("*") לכל שדכן ואיש צוות.
-- טריגר ולא עריכת שתי הפונקציות - כדי לא לשכפל כאן את גופן המלא.
CREATE OR REPLACE FUNCTION public.students_discard_image_url() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.image_url := NULL;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.students_discard_image_url() OWNER TO postgres;

COMMENT ON FUNCTION public.students_discard_image_url()
  IS 'מאפס את students.image_url בכל כתיבה - העמודה הוחלפה ב-student_photos';

COMMENT ON COLUMN public.students.image_url
  IS 'מיושן: תמיד NULL (טריגר). התמונות נמצאות ב-student_photos';

DROP TRIGGER IF EXISTS trigger_students_discard_image_url ON public.students;
CREATE TRIGGER trigger_students_discard_image_url
  BEFORE INSERT OR UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.students_discard_image_url();
