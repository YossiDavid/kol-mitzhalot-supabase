-- Storage RLS Policies for 'students' bucket
-- הרצת הקובץ הזה ב-Supabase SQL Editor תגדיר את ה-policies הנדרשים
-- הערה: אם יש policies קיימות, יש למחוק אותן קודם או להשתמש ב-DROP POLICY IF EXISTS

-- מחיקת policies קיימות (אם יש)
DROP POLICY IF EXISTS "Users can upload files to their own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload files to student folders" ON storage.objects;
DROP POLICY IF EXISTS "Users can read student files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update student files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete student files" ON storage.objects;

-- 1. אפשר למשתמשים מאומתים להעלות קבצים לתיקייה שלהם (user_id) או לתיקיית סטודנט שהם יצרו
CREATE POLICY "Users can upload files to student folders"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'students' AND
  (
    -- גישה לתיקייה של user_id
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    -- גישה לתיקייה של student_id אם המשתמש הוא הבעלים של הסטודנט
    EXISTS (
      SELECT 1 FROM public.students
      WHERE id::text = (storage.foldername(name))[1]
      AND user_id = auth.uid()
    )
  )
);

-- 2. אפשר למשתמשים מאומתים לקרוא קבצים מתיקייה שלהם או מתיקיית סטודנט שהם יצרו
CREATE POLICY "Users can read student files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'students' AND
  (
    -- גישה לתיקייה של user_id
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    -- גישה לתיקייה של student_id אם המשתמש הוא הבעלים של הסטודנט
    EXISTS (
      SELECT 1 FROM public.students
      WHERE id::text = (storage.foldername(name))[1]
      AND user_id = auth.uid()
    )
  )
);

-- 3. אפשר למשתמשים מאומתים לעדכן קבצים בתיקייה שלהם או בתיקיית סטודנט שהם יצרו
CREATE POLICY "Users can update student files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'students' AND
  (
    -- גישה לתיקייה של user_id
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    -- גישה לתיקייה של student_id אם המשתמש הוא הבעלים של הסטודנט
    EXISTS (
      SELECT 1 FROM public.students
      WHERE id::text = (storage.foldername(name))[1]
      AND user_id = auth.uid()
    )
  )
)
WITH CHECK (
  bucket_id = 'students' AND
  (
    -- גישה לתיקייה של user_id
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    -- גישה לתיקייה של student_id אם המשתמש הוא הבעלים של הסטודנט
    EXISTS (
      SELECT 1 FROM public.students
      WHERE id::text = (storage.foldername(name))[1]
      AND user_id = auth.uid()
    )
  )
);

-- 4. אפשר למשתמשים מאומתים למחוק קבצים מתיקייה שלהם או מתיקיית סטודנט שהם יצרו
CREATE POLICY "Users can delete student files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'students' AND
  (
    -- גישה לתיקייה של user_id
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    -- גישה לתיקייה של student_id אם המשתמש הוא הבעלים של הסטודנט
    EXISTS (
      SELECT 1 FROM public.students
      WHERE id::text = (storage.foldername(name))[1]
      AND user_id = auth.uid()
    )
  )
);

-- הערה: ודא/י שה-bucket 'students' קיים ב-Storage
-- אם לא, צור אותו ב-Supabase Dashboard > Storage > New bucket
-- ושם: students, Public: false (מומלץ)

