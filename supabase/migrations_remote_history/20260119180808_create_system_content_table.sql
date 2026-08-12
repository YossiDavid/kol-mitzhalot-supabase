-- יצירת טבלת system_content לאחסון תוכן מערכת
CREATE TABLE IF NOT EXISTS public.system_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- יצירת אינדקס
CREATE INDEX IF NOT EXISTS idx_system_content_key ON public.system_content(key);

-- הפעלת RLS
ALTER TABLE public.system_content ENABLE ROW LEVEL SECURITY;

-- מדיניות: רק אדמינים יכולים לערוך
CREATE POLICY "Only admins can manage system content"
  ON public.system_content
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'role')::text = 'admin'
    )
  );

-- מדיניות: כל המשתמשים המאומתים יכולים לקרוא
CREATE POLICY "Authenticated users can read system content"
  ON public.system_content
  FOR SELECT
  TO authenticated
  USING (true);

-- פונקציה לעדכון updated_at
CREATE OR REPLACE FUNCTION update_system_content_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- טריגר לעדכון updated_at
CREATE TRIGGER trigger_update_system_content_updated_at
  BEFORE UPDATE ON public.system_content
  FOR EACH ROW
  EXECUTE FUNCTION update_system_content_updated_at();

COMMENT ON TABLE public.system_content IS 'טבלת תוכן מערכת - מכילה תוכן כמו מדיניות פרטיות, תנאי שימוש וכו';
COMMENT ON COLUMN public.system_content.key IS 'מפתח ייחודי לזיהוי התוכן (לדוגמה: privacy_policy, terms_of_service)';
COMMENT ON COLUMN public.system_content.title IS 'כותרת התוכן';
COMMENT ON COLUMN public.system_content.content IS 'תוכן HTML/מעוצב';;
