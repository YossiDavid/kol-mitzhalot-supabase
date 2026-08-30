-- מחמאות והערות על כרטיס מיועד ("student_notes").
--
-- מי כותב: איש צוות מאושר (staff_info.application_status = 'approved') על
-- מיועדים ששייכים למוסד שלו בלבד (institution_id תואם), וכל שדכן/מנהל -
-- על כל מיועד. מי קורא: שדכן, מנהל, ומחבר ההערה עצמו (כדי שאיש צוות יוכל
-- לראות מה שהוא עצמו כתב, אבל לא הערות של אנשי צוות אחרים על אותו מיועד -
-- ראה staff_can_access_student למטה, שנועדה לביקורת ה-INSERT בלבד, לא ה-SELECT).
--
-- אידמפוטנטית - ניתן להריץ שוב על סביבה שכבר הוחלה עליה בלי שגיאה.

CREATE TABLE IF NOT EXISTS public.student_notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  author_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body       text NOT NULL CHECK (length(btrim(body)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.student_notes IS 'מחמאות והערות שכותבים שדכנים/מנהלים/אנשי צוות על כרטיס מיועד';
COMMENT ON COLUMN public.student_notes.student_id IS 'הכרטיס שעליו נכתבה ההערה';
COMMENT ON COLUMN public.student_notes.author_id IS 'מי כתב את ההערה';
COMMENT ON COLUMN public.student_notes.body IS 'תוכן ההערה';

CREATE INDEX IF NOT EXISTS idx_student_notes_student_id_created_at
  ON public.student_notes (student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_student_notes_author_id
  ON public.student_notes (author_id);

-- טריגר updated_at, מקביל ל-update_staff_info_updated_at()
-- (supabase/migrations/20260830130000_create_staff_info_table.sql)
CREATE OR REPLACE FUNCTION public.update_student_notes_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_student_notes_updated_at ON public.student_notes;
CREATE TRIGGER trigger_update_student_notes_updated_at
  BEFORE UPDATE ON public.student_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_student_notes_updated_at();

-- פונקציית עזר: האם למשתמש uid יש הרשאת גישה (לכתיבת הערה) למיועד sid,
-- מכוח היותו איש צוות מאושר במוסד של אותו מיועד. לא בודקת שדכן/מנהל - זה
-- נבדק בנפרד (is_shadchan_or_admin) בכל מדיניות שמשתמשת בפונקציה הזו.
CREATE OR REPLACE FUNCTION public.staff_can_access_student(uid uuid, sid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.students s
    JOIN public.staff_info si ON si.institution_id = s.institution_id
    WHERE s.id = sid
      AND s.deleted_at IS NULL
      AND si.user_id = uid
      AND si.application_status = 'approved'
      AND si.institution_id IS NOT NULL
  );
$$;

ALTER FUNCTION public.staff_can_access_student(uuid, uuid) OWNER TO postgres;

COMMENT ON FUNCTION public.staff_can_access_student(uuid, uuid) IS 'בודק אם משתמש הוא איש צוות מאושר ששייך למוסד של המיועד הנתון (ולכן רשאי לגשת אליו/לכתוב עליו הערה)';

GRANT ALL ON FUNCTION public.staff_can_access_student(uuid, uuid) TO anon;
GRANT ALL ON FUNCTION public.staff_can_access_student(uuid, uuid) TO authenticated;
GRANT ALL ON FUNCTION public.staff_can_access_student(uuid, uuid) TO service_role;

ALTER TABLE public.student_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Student_notes select own or shadchan_admin" ON public.student_notes;
CREATE POLICY "Student_notes select own or shadchan_admin" ON public.student_notes
  FOR SELECT USING (public.is_shadchan_or_admin() OR author_id = auth.uid());

DROP POLICY IF EXISTS "Student_notes insert scoped" ON public.student_notes;
CREATE POLICY "Student_notes insert scoped" ON public.student_notes
  FOR INSERT WITH CHECK (
    author_id = auth.uid()
    AND (public.is_shadchan_or_admin() OR public.staff_can_access_student(auth.uid(), student_id))
  );

DROP POLICY IF EXISTS "Student_notes update own or admin" ON public.student_notes;
CREATE POLICY "Student_notes update own or admin" ON public.student_notes
  FOR UPDATE USING (author_id = auth.uid() OR public.is_admin())
  WITH CHECK (author_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Student_notes delete own or admin" ON public.student_notes;
CREATE POLICY "Student_notes delete own or admin" ON public.student_notes
  FOR DELETE USING (author_id = auth.uid() OR public.is_admin());

GRANT ALL ON TABLE public.student_notes TO anon;
GRANT ALL ON TABLE public.student_notes TO authenticated;
GRANT ALL ON TABLE public.student_notes TO service_role;

-- הרחבת מדיניות ה-SELECT של students: איש צוות מאושר רואה כעת גם כרטיסים
-- של המוסד שלו (בנוסף לכרטיס שלו עצמו ולראייה המלאה של שדכן/מנהל). שם
-- המדיניות נשאר זהה בכוונה (20260830120000_students_soft_delete.sql) כדי
-- שלא לשבור הפניות קיימות אליה.
DROP POLICY IF EXISTS "Users can view own profile or shadchanim see all" ON public.students;
CREATE POLICY "Users can view own profile or shadchanim see all"
  ON public.students FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      auth.uid() = user_id
      OR public.is_shadchan_or_admin()
      OR public.staff_can_access_student(auth.uid(), id)
    )
  );
