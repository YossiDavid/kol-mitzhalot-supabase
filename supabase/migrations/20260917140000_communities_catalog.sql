-- מאגר חסידויות וקהילות: השדה "חסידות או קהילה" בטופס המיועד הופך לבורר עם
-- חיפוש מתוך המאגר, ומי שמקליד ערך שאינו קיים יכול להוסיף אותו.
--
-- הערך עצמו ממשיך להישמר ב-students.community כטקסט (וכך גם בשורות ההשכלה,
-- בתוך education_history.community): המאגר הוא מקור הצעות ואחידות, ולא מפתח
-- זר. כך כל הכרטיסים הקיימים נשארים תקפים ואין המרת נתונים.
--
-- הרשאות: כל משתמש מחובר קורא ומוסיף (זו הבקשה - מי שהקליד ערך חדש מוסיף
-- אותו למאגר); עדכון ומחיקה למנהל בלבד.
--
-- אידמפוטנטית - ניתן להריץ שוב.

CREATE TABLE IF NOT EXISTS public.communities (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT communities_name_not_blank CHECK (length(btrim(name)) BETWEEN 1 AND 60)
);

COMMENT ON TABLE  public.communities            IS 'מאגר חסידויות וקהילות לבחירה בטופס המיועד. כל משתמש מחובר יכול להוסיף ערך שאינו קיים; הערך נשמר בכרטיס כטקסט ולא כמפתח זר.';
COMMENT ON COLUMN public.communities.name       IS 'שם החסידות / הקהילה';
COMMENT ON COLUMN public.communities.is_active  IS 'ערך לא פעיל נשאר בכרטיסים קיימים אך אינו מוצע לבחירה חדשה';
COMMENT ON COLUMN public.communities.created_by IS 'מי הוסיף את הערך למאגר. NULL לערכי ברירת המחדל';

-- כפילות נמנעת בלי תלות ברווחים ובאותיות (למשל "בעלזא " ו-"בעלזא")
CREATE UNIQUE INDEX IF NOT EXISTS communities_name_unique_idx
  ON public.communities (lower(btrim(name)));

CREATE INDEX IF NOT EXISTS communities_is_active_idx
  ON public.communities (is_active);

CREATE OR REPLACE FUNCTION public.update_communities_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.update_communities_updated_at() OWNER TO postgres;

DROP TRIGGER IF EXISTS trigger_update_communities_updated_at ON public.communities;
CREATE TRIGGER trigger_update_communities_updated_at
  BEFORE UPDATE ON public.communities
  FOR EACH ROW EXECUTE FUNCTION public.update_communities_updated_at();

ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;

-- קריאה: כל מחובר רואה ערכים פעילים; מנהל רואה גם לא פעילים
DROP POLICY IF EXISTS "Communities select active for authenticated" ON public.communities;
CREATE POLICY "Communities select active for authenticated" ON public.communities
  FOR SELECT TO authenticated
  USING (is_active OR public.is_admin());

-- הוספה: כל מחובר, ובלבד שהערך מסומן על שמו ופעיל
DROP POLICY IF EXISTS "Communities insert for authenticated" ON public.communities;
CREATE POLICY "Communities insert for authenticated" ON public.communities
  FOR INSERT TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()) AND is_active);

DROP POLICY IF EXISTS "Communities admin manage all" ON public.communities;
CREATE POLICY "Communities admin manage all" ON public.communities
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT, INSERT ON TABLE public.communities TO authenticated;
GRANT UPDATE, DELETE ON TABLE public.communities TO authenticated;
GRANT ALL ON TABLE public.communities TO service_role;

-- ── ערכי ברירת המחדל ──────────────────────────────────────────────
INSERT INTO public.communities (name)
SELECT value
FROM (VALUES ('בעלזא'), ('צאנז'), ('קרלין'), ('ויז׳ניץ')) AS defaults(value)
ON CONFLICT DO NOTHING;

-- ── השלמה ממה שכבר הוזן בכרטיסים ─────────────────────────────────
-- המאגר משקף גם ערכים שהוקלדו בעבר כטקסט חופשי, כדי שלא יופיעו כ"חדשים".
INSERT INTO public.communities (name)
SELECT DISTINCT ON (lower(btrim(s.community))) btrim(s.community)
FROM public.students s
WHERE s.community IS NOT NULL
  AND length(btrim(s.community)) BETWEEN 1 AND 60
  AND NOT EXISTS (
    SELECT 1 FROM public.communities c
    WHERE lower(btrim(c.name)) = lower(btrim(s.community))
  )
ON CONFLICT DO NOTHING;
