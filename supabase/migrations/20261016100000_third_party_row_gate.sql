-- כרטיס צד שלישי שלא אושר להצגה מלאה, שלב 2 מתוך 2: חסימת הקריאה הישירה.
--
-- להחיל רק אחרי ש-20261016090000_student_cards_view.sql הוחל והקוד שקורא את
-- הרשימות והכרטיס הבסיסי דרך student_cards עלה לאוויר. קוד ישן מול המסד הזה:
-- כרטיס ממתין נעלם לשדכן מהרשימות, ופתיחת הכרטיס שלו מציגה "שגיאה בטעינת
-- הפרופיל".
--
-- מה משתנה: שורת students של כרטיס מוגבל (student_display_restricted) אינה
-- נקראת ישירות על ידי מי שאינו בעל הכרטיס או מנהל - לא עמודה אחת ממנה, וגם
-- לא כסינון או מיון. שדכן ואיש צוות מקבלים את הנתונים הבסיסיים דרך
-- student_cards. כרטיס שאינו מוגבל (כולל כרטיס ישן בלי card_for וכרטיס צד
-- שלישי שאושר), בעלים, מנהלים וכל הכתיבות - בלי שינוי.
-- אידמפוטנטית; להחלה: psql --single-transaction -v ON_ERROR_STOP=1 -f <file>

-- 1. בדיקת המגדר של הצעה קוראת את students. עד היום היא רצה בהרשאות השדכן,
--    ועם החסימה שלמטה לא הייתה מוצאת כרטיס מוגבל (גם כזה שאושר לקבל הצעות)
--    ומסרבת להצעה. הגוף זהה למקור; רק ההרשאה שבה הוא רץ השתנתה.
CREATE OR REPLACE FUNCTION public.validate_shidduch_genders() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  groom_gender public.gender_enum;
  bride_gender public.gender_enum;
BEGIN
  -- בדיקת מגדר החתן
  SELECT gender INTO groom_gender
  FROM public.students
  WHERE id = NEW.groom_id AND deleted_at IS NULL;

  IF groom_gender IS NULL THEN
    RAISE EXCEPTION 'כרטיס החתן לא נמצא או שנמחק';
  END IF;

  IF groom_gender != 'male' THEN
    RAISE EXCEPTION 'Groom must be male (groom_id cannot be a student with gender=female)';
  END IF;

  -- בדיקת מגדר הכלה
  SELECT gender INTO bride_gender
  FROM public.students
  WHERE id = NEW.bride_id AND deleted_at IS NULL;

  IF bride_gender IS NULL THEN
    RAISE EXCEPTION 'כרטיס הכלה לא נמצא או שנמחק';
  END IF;

  IF bride_gender != 'female' THEN
    RAISE EXCEPTION 'Bride must be female (bride_id cannot be a student with gender=male)';
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.validate_shidduch_genders() OWNER TO postgres;
-- פונקציית טריגר בלבד: אין סיבה שתיקרא ישירות
REVOKE ALL ON FUNCTION public.validate_shidduch_genders() FROM PUBLIC, anon, authenticated;

-- 2. מדיניות מגבילה (RESTRICTIVE): מצטרפת ב-AND למדיניות הקיימת, ולכן אינה
--    מרחיבה גישה לאף אחד. שני התנאים הראשונים נגזרים מהכלל עצמו ורק חוסכים את
--    הקריאה לפונקציה בכרטיסים שאינם צד שלישי ממתין; ההכרעה - של
--    student_display_restricted (false לבעלים ולמנהל).
DROP POLICY IF EXISTS "Restricted third party cards are not read directly" ON public.students;
CREATE POLICY "Restricted third party cards are not read directly" ON public.students
  AS RESTRICTIVE
  FOR SELECT
  USING (
    card_for IS DISTINCT FROM 'other'
    OR third_party_full_display_approved_at IS NOT NULL
    OR NOT public.student_display_restricted(id)
  );

NOTIFY pgrst, 'reload schema';

-- ── rollback ─────────────────────────────────────────────────────────
-- מחזיר את הקריאה הישירה ואת פונקציית הטריגר כפי שהיו.
--
--   DROP POLICY IF EXISTS "Restricted third party cards are not read directly" ON public.students;
--
--   CREATE OR REPLACE FUNCTION public.validate_shidduch_genders() RETURNS trigger
--       LANGUAGE plpgsql
--       AS $fn$
--   DECLARE
--     groom_gender gender_enum;
--     bride_gender gender_enum;
--   BEGIN
--     SELECT gender INTO groom_gender
--     FROM public.students
--     WHERE id = NEW.groom_id AND deleted_at IS NULL;
--     IF groom_gender IS NULL THEN
--       RAISE EXCEPTION 'כרטיס החתן לא נמצא או שנמחק';
--     END IF;
--     IF groom_gender != 'male' THEN
--       RAISE EXCEPTION 'Groom must be male (groom_id cannot be a student with gender=female)';
--     END IF;
--     SELECT gender INTO bride_gender
--     FROM public.students
--     WHERE id = NEW.bride_id AND deleted_at IS NULL;
--     IF bride_gender IS NULL THEN
--       RAISE EXCEPTION 'כרטיס הכלה לא נמצא או שנמחק';
--     END IF;
--     IF bride_gender != 'female' THEN
--       RAISE EXCEPTION 'Bride must be female (bride_id cannot be a student with gender=male)';
--     END IF;
--     RETURN NEW;
--   END;
--   $fn$;
--   ALTER FUNCTION public.validate_shidduch_genders() RESET search_path;
--   GRANT EXECUTE ON FUNCTION public.validate_shidduch_genders() TO PUBLIC, anon, authenticated, service_role;
--   NOTIFY pgrst, 'reload schema';
