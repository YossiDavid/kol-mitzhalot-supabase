-- מספר תעודת הזהות של המיועד/ת, שלב 1 מתוך 2: טבלה נפרדת לבעלים ולמנהלים.
--
-- הטופס כבר אינו שואל על ת.ז. ושום דף אינו מציג אותה, אבל כרטיסים ישנים עדיין
-- מחזיקים ערך ב-students.identity_number - וכל מי שרואה את השורה (שדכן, איש צוות
-- של המוסד) יכול היה לקרוא אותו ישירות. RLS הוא ברמת שורה, ולכן הערכים עוברים
-- לטבלה שרק בעל הכרטיס ומנהלים קוראים.
--
-- כאן: הטבלה, ההרשאות, והעתקה של הערכים הקיימים. students.identity_number עדיין
-- לא נוגעים בו (ההעתקה אינה מוחקת דבר). שלב 2
-- (20261023110000_student_identity_move.sql) מוודא שכל ערך הועתק, ורק אז מרוקן
-- את העמודה ב-students ומונע כתיבה אליה. האפליקציה אינה קוראת את העמודה, ולכן
-- שני השלבים בטוחים לפני הקוד ואחריו.
-- אידמפוטנטית. להחלה: psql --single-transaction -v ON_ERROR_STOP=1 -f <file>

CREATE TABLE IF NOT EXISTS public.student_identity_numbers (
  student_id uuid PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE,
  identity_number text NOT NULL CHECK (btrim(identity_number) <> ''),
  copied_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.student_identity_numbers IS
  'מספר ת.ז. של מיועד/ת שנאסף בעבר (הטופס כבר אינו שואל עליו). לבעל הכרטיס ולמנהלים בלבד. מחיקה סופית של כל הערכים: DROP TABLE public.student_identity_numbers;';

ALTER TABLE public.student_identity_numbers ENABLE ROW LEVEL SECURITY;

-- קריאה: בעל הכרטיס ומנהל. אין מדיניות כתיבה - כותבים רק המיגרציה ו-service role.
DROP POLICY IF EXISTS "Identity numbers are read by owner and admin" ON public.student_identity_numbers;
CREATE POLICY "Identity numbers are read by owner and admin" ON public.student_identity_numbers
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_identity_numbers.student_id
        AND s.user_id = (SELECT auth.uid())
    )
  );

REVOKE ALL ON public.student_identity_numbers FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.student_identity_numbers TO authenticated;
GRANT ALL ON public.student_identity_numbers TO service_role;

-- העתקה (לא העברה): ערך שכבר הועתק אינו נדרס
INSERT INTO public.student_identity_numbers (student_id, identity_number)
SELECT s.id, btrim(s.identity_number)
  FROM public.students s
 WHERE s.identity_number IS NOT NULL
   AND btrim(s.identity_number) <> ''
ON CONFLICT (student_id) DO NOTHING;

NOTIFY pgrst, 'reload schema';

-- ── rollback ─────────────────────────────────────────────────────────
-- בטוח כל עוד שלב 2 לא הוחל (הערכים עדיין גם ב-students). אחרי שלב 2: קודם
-- rollback של שלב 2 (שמחזיר את הערכים ל-students), ורק אז זה.
--   DROP TABLE IF EXISTS public.student_identity_numbers;
--   NOTIFY pgrst, 'reload schema';
