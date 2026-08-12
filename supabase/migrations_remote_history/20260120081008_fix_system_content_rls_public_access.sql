-- הסרת ה-policy הישן שמאפשר רק למשתמשים מחוברים
DROP POLICY IF EXISTS "Authenticated users can read system content" ON system_content;

-- יצירת policy חדש שמאפשר לכולם לקרוא (כולל משתמשים לא מחוברים)
CREATE POLICY "Anyone can read system content"
  ON system_content
  FOR SELECT
  TO public
  USING (true);

-- ה-policy לניהול נשאר כמו שהוא (רק אדמינים יכולים לערוך)
-- "Only admins can manage system content" - כבר קיים;
