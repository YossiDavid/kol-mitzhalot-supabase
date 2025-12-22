-- תיקון RLS Policies עבור medical_records
-- הבעיה: יכול להיות שיש RLS policies שמונעות קריאה של medical_records

-- Policy לקריאת medical_records
DROP POLICY IF EXISTS "Users can read medical records for their students" ON public.medical_records;
CREATE POLICY "Users can read medical records for their students"
ON public.medical_records
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.students
    WHERE students.id = medical_records.student_id
    AND students.user_id = auth.uid()
  )
);

-- אם אתה רוצה לאפשר גם לשדכנים/מנהלים לראות, תוכל להוסיף:
-- OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'shadchan')
-- OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')

-- הערה: ודא/י שיש foreign key relationship בין students ל-medical_records
-- בדוק ב-Supabase Dashboard > Table Editor > medical_records > Relationships

