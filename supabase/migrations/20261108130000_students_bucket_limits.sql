-- ה-bucket "students" (תמונות, קו"ח, מסמכים רפואיים) היה בלי מגבלת גודל ובלי
-- רשימת סוגים: כל נרשם יכול היה להעלות כל קובץ (גם HTML/SVG) בכל גודל.
-- הסוגים: מה שהאתר מקבל בפועל (ACCEPTED_PHOTO_TYPES, DOCUMENT_ACCEPT,
-- cv-file-rules). הגודל: 25MB - הקובץ הגדול ביותר כיום הוא כ-23MB.
--
-- ROLLBACK:
--   UPDATE storage.buckets SET file_size_limit = NULL, allowed_mime_types = NULL
--    WHERE id = 'students';
UPDATE storage.buckets
   SET file_size_limit = 25 * 1024 * 1024,
       allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
 WHERE id = 'students';
