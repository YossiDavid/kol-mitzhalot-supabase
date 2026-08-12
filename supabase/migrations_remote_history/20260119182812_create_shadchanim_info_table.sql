-- יצירת טבלת shadchanim_info לאחסון מידע נוסף על שדכנים
CREATE TABLE IF NOT EXISTS public.shadchanim_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  bio TEXT,
  experience_years INTEGER,
  specializations TEXT[],
  contact_phone TEXT,
  contact_email TEXT,
  website_url TEXT,
  location TEXT,
  languages TEXT[],
  certifications TEXT[],
  additional_info JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- יצירת אינדקסים
CREATE INDEX IF NOT EXISTS idx_shadchanim_info_user_id ON public.shadchanim_info(user_id);
CREATE INDEX IF NOT EXISTS idx_shadchanim_info_location ON public.shadchanim_info(location);

-- הפעלת RLS
ALTER TABLE public.shadchanim_info ENABLE ROW LEVEL SECURITY;

-- מדיניות: שדכנים יכולים לראות ולערוך את המידע שלהם
CREATE POLICY "Shadchanim can view their own info"
  ON public.shadchanim_info
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Shadchanim can update their own info"
  ON public.shadchanim_info
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Shadchanim can insert their own info"
  ON public.shadchanim_info
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- מדיניות: אדמינים יכולים לראות ולערוך את כל המידע
CREATE POLICY "Admins can view all shadchanim info"
  ON public.shadchanim_info
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'role')::text = 'admin'
    )
  );

CREATE POLICY "Admins can manage all shadchanim info"
  ON public.shadchanim_info
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'role')::text = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'role')::text = 'admin'
    )
  );

-- פונקציה לעדכון updated_at
CREATE OR REPLACE FUNCTION update_shadchanim_info_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- טריגר לעדכון updated_at
CREATE TRIGGER trigger_update_shadchanim_info_updated_at
  BEFORE UPDATE ON public.shadchanim_info
  FOR EACH ROW
  EXECUTE FUNCTION update_shadchanim_info_updated_at();

COMMENT ON TABLE public.shadchanim_info IS 'מידע נוסף על שדכנים - ביוגרפיה, ניסיון, התמחויות וכו';
COMMENT ON COLUMN public.shadchanim_info.user_id IS 'מזהה המשתמש (חייב להיות שדכן)';
COMMENT ON COLUMN public.shadchanim_info.bio IS 'ביוגרפיה של השדכן';
COMMENT ON COLUMN public.shadchanim_info.experience_years IS 'שנות ניסיון';
COMMENT ON COLUMN public.shadchanim_info.specializations IS 'התמחויות (מערך טקסט)';
COMMENT ON COLUMN public.shadchanim_info.languages IS 'שפות שהשדכן דובר';
COMMENT ON COLUMN public.shadchanim_info.certifications IS 'תעודות והסמכות';;
