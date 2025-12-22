-- יצירת טבלת שידוכים (Shidduchim)
-- טבלה זו מכילה את כל השידוכים במערכת

-- 1. יצירת enum עבור סטטוס השידוך
CREATE TYPE shidduch_status_enum AS ENUM (
  'pending',      -- ממתין לאישור
  'approved',     -- מאושר
  'rejected',     -- נדחה
  'in_progress',  -- בתהליך
  'completed',    -- הושלם
  'cancelled'     -- בוטל
);

-- 2. יצירת הטבלה
CREATE TABLE IF NOT EXISTS public.shidduchim (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  groom_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  bride_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  shadchan_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status shidduch_status_enum NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- אילוץ: אותו שידוך לא יכול להיות ל-2 שדכנים שונים
  -- (אותו חתן + אותה כלה = שידוך יחיד)
  CONSTRAINT unique_shidduch_pair UNIQUE (groom_id, bride_id)
);

-- 3. יצירת אינדקסים לביצועים
CREATE INDEX IF NOT EXISTS idx_shidduchim_groom_id ON public.shidduchim(groom_id);
CREATE INDEX IF NOT EXISTS idx_shidduchim_bride_id ON public.shidduchim(bride_id);
CREATE INDEX IF NOT EXISTS idx_shidduchim_shadchan_id ON public.shidduchim(shadchan_id);
CREATE INDEX IF NOT EXISTS idx_shidduchim_status ON public.shidduchim(status);
CREATE INDEX IF NOT EXISTS idx_shidduchim_created_at ON public.shidduchim(created_at DESC);

-- 4. יצירת פונקציה לעדכון updated_at אוטומטית
CREATE OR REPLACE FUNCTION update_shidduchim_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. יצירת טריגר לעדכון updated_at
CREATE TRIGGER trigger_update_shidduchim_updated_at
  BEFORE UPDATE ON public.shidduchim
  FOR EACH ROW
  EXECUTE FUNCTION update_shidduchim_updated_at();

-- 5.1. יצירת פונקציה לאימות מגדר החתן והכלה
CREATE OR REPLACE FUNCTION validate_shidduch_genders()
RETURNS TRIGGER AS $$
DECLARE
  groom_gender gender_enum;
  bride_gender gender_enum;
BEGIN
  -- בדיקת מגדר החתן
  SELECT gender INTO groom_gender
  FROM public.students
  WHERE id = NEW.groom_id;
  
  IF groom_gender IS NULL THEN
    RAISE EXCEPTION 'Groom student not found';
  END IF;
  
  IF groom_gender != 'male' THEN
    RAISE EXCEPTION 'Groom must be male (groom_id cannot be a student with gender=female)';
  END IF;
  
  -- בדיקת מגדר הכלה
  SELECT gender INTO bride_gender
  FROM public.students
  WHERE id = NEW.bride_id;
  
  IF bride_gender IS NULL THEN
    RAISE EXCEPTION 'Bride student not found';
  END IF;
  
  IF bride_gender != 'female' THEN
    RAISE EXCEPTION 'Bride must be female (bride_id cannot be a student with gender=male)';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5.2. יצירת טריגר לאימות מגדר לפני INSERT או UPDATE
CREATE TRIGGER trigger_validate_shidduch_genders
  BEFORE INSERT OR UPDATE ON public.shidduchim
  FOR EACH ROW
  EXECUTE FUNCTION validate_shidduch_genders();

-- 6. הפעלת Row Level Security (RLS)
ALTER TABLE public.shidduchim ENABLE ROW LEVEL SECURITY;

-- 7. יצירת RLS Policies
-- מדיניות: משתמשים יכולים לראות רק את השידוכים שלהם (כשדכנים)
CREATE POLICY "Users can view their own shidduchim as shadchan"
  ON public.shidduchim
  FOR SELECT
  USING (auth.uid() = shadchan_id);

-- מדיניות: משתמשים יכולים ליצור שידוכים חדשים
CREATE POLICY "Users can create shidduchim"
  ON public.shidduchim
  FOR INSERT
  WITH CHECK (auth.uid() = shadchan_id);

-- מדיניות: משתמשים יכולים לעדכן רק את השידוכים שלהם
CREATE POLICY "Users can update their own shidduchim"
  ON public.shidduchim
  FOR UPDATE
  USING (auth.uid() = shadchan_id)
  WITH CHECK (auth.uid() = shadchan_id);

-- מדיניות: משתמשים יכולים למחוק רק את השידוכים שלהם
CREATE POLICY "Users can delete their own shidduchim"
  ON public.shidduchim
  FOR DELETE
  USING (auth.uid() = shadchan_id);

-- הערות על הטבלה
COMMENT ON TABLE public.shidduchim IS 'טבלת שידוכים - מכילה את כל השידוכים במערכת';
COMMENT ON COLUMN public.shidduchim.groom_id IS 'מזהה החתן (חייב להיות student עם gender=male)';
COMMENT ON COLUMN public.shidduchim.bride_id IS 'מזהה הכלה (חייב להיות student עם gender=female)';
COMMENT ON COLUMN public.shidduchim.shadchan_id IS 'מזהה השדכן (המשתמש שיצר את השידוך)';
COMMENT ON COLUMN public.shidduchim.status IS 'סטטוס השידוך: pending, approved, rejected, in_progress, completed, cancelled';

