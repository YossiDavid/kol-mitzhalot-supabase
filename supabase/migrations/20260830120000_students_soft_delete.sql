-- מחיקה רכה לכרטיסי מיועדים.
--
-- למה רכה ולא מחיקה פיזית: לכל שורה ב-students יש שמונה מפתחות זרים עם
-- ON DELETE CASCADE (education_history, employment_history, medical_records,
-- partner_preferences, previous_partners, references, ו-shidduchim פעמיים —
-- כחתן וככלה). מחיקה פיזית של כרטיס אחד הייתה מוחקת גם את היסטוריית
-- השידוכים של הצד השני, שאיש לא ביקש למחוק.
--
-- deleted_at IS NULL     = כרטיס פעיל
-- deleted_at IS NOT NULL = נמחק (רך). נשאר ב-DB, נעלם מהמערכת.

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.students.deleted_at IS
  'מועד מחיקה רכה. NULL = כרטיס פעיל. נקבע ע"י מנהל מערכת או ע"י ארכוב אוטומטי של מאורסים.';
COMMENT ON COLUMN public.students.deleted_by IS
  'מי ביצע את המחיקה. NULL כשהמחיקה בוצעה אוטומטית ע"י המערכת.';

-- אינדקס חלקי: כל שאילתות המערכת מסננות deleted_at IS NULL
CREATE INDEX IF NOT EXISTS students_active_idx
  ON public.students (id)
  WHERE deleted_at IS NULL;

-- מאתר מועמדים לארכוב אוטומטי (מאורסים מעל חודש)
CREATE INDEX IF NOT EXISTS students_engaged_status_changed_idx
  ON public.students (status_changed_at)
  WHERE deleted_at IS NULL AND personal_status = 'engaged';

-- הגנה בעומק: כרטיס מחוק לא נראה דרך RLS לאף תפקיד, גם אם נשכח סינון
-- בצד האפליקציה. גישה לכרטיסים מחוקים אפשרית רק דרך service role
-- (ה-API של המנהל), שעוקף RLS ממילא.
DROP POLICY IF EXISTS "Users can view own profile or shadchanim see all" ON public.students;
CREATE POLICY "Users can view own profile or shadchanim see all"
  ON public.students FOR SELECT
  USING (
    deleted_at IS NULL
    AND (auth.uid() = user_id OR public.is_shadchan_or_admin())
  );

-- מונע יצירת שידוך מול כרטיס שנמחק מחיקה רכה. ה-trigger המקורי כבר בודק
-- מגדר; כאן מוסיפים גם AND deleted_at IS NULL לשתי הבדיקות, כך שכרטיס
-- מחוק ייחשב "לא נמצא" בדיוק כמו כרטיס שלא קיים כלל.
CREATE OR REPLACE FUNCTION "public"."validate_shidduch_genders"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  groom_gender gender_enum;
  bride_gender gender_enum;
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
