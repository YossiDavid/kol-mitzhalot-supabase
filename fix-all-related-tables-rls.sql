-- תיקון RLS Policies עבור כל הטבלאות הקשורות לסטודנטים
-- הבעיה: RLS policies מונעות קריאה של הטבלאות הקשורות

-- 1. Policy עבור education_history
DROP POLICY IF EXISTS "Users can read education history for their students" ON public.education_history;
CREATE POLICY "Users can read education history for their students"
ON public.education_history
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.students
    WHERE students.id = education_history.student_id
    AND students.user_id = auth.uid()
  )
);

-- 2. Policy עבור employment_history
DROP POLICY IF EXISTS "Users can read employment history for their students" ON public.employment_history;
CREATE POLICY "Users can read employment history for their students"
ON public.employment_history
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.students
    WHERE students.id = employment_history.student_id
    AND students.user_id = auth.uid()
  )
);

-- 3. Policy עבור medical_records
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

-- Policy לעדכון medical_records (נדרש לעדכון documents)
DROP POLICY IF EXISTS "Users can update medical records for their students" ON public.medical_records;
CREATE POLICY "Users can update medical records for their students"
ON public.medical_records
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.students
    WHERE students.id = medical_records.student_id
    AND students.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.students
    WHERE students.id = medical_records.student_id
    AND students.user_id = auth.uid()
  )
);

-- 4. Policy עבור partner_preferences
DROP POLICY IF EXISTS "Users can read partner preferences for their students" ON public.partner_preferences;
CREATE POLICY "Users can read partner preferences for their students"
ON public.partner_preferences
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.students
    WHERE students.id = partner_preferences.student_id
    AND students.user_id = auth.uid()
  )
);

-- 5. Policy עבור references (references היא מילה שמורה, צריך להשתמש ב-public.references)
DROP POLICY IF EXISTS "Users can read references for their students" ON public.references;
CREATE POLICY "Users can read references for their students"
ON public.references
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.students
    WHERE students.id = public.references.student_id
    AND students.user_id = auth.uid()
  )
);

-- 6. Policy עבור previous_partners
DROP POLICY IF EXISTS "Users can read previous partners for their students" ON public.previous_partners;
CREATE POLICY "Users can read previous partners for their students"
ON public.previous_partners
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.students
    WHERE students.id = previous_partners.student_id
    AND students.user_id = auth.uid()
  )
);

-- הערה: אם אתה רוצה לאפשר גם לשדכנים/מנהלים לראות את הנתונים,
-- תוכל להוסיף תנאים נוספים כמו:
-- OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'shadchan')
-- OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')

-- בדיקה: אחרי הרצת הקובץ, בדוק ב-Supabase Dashboard > Authentication > Policies
-- שכל ה-policies נוצרו בהצלחה

