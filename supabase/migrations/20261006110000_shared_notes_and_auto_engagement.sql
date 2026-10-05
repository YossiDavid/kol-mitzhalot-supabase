-- שני שינויים שהלקוח ביקש:
--   א. "הערות שדכן" גלויות לכל השדכנים ולמנהלים (ולאף אחד אחר).
--   ב. שידוך שנסגר בתוך המערכת יוצר מודעת אירוסין אוטומטית (לא מפורסמת).
--
-- אידמפוטנטית - ניתן להריץ שוב.

-- ══ א. הערות שדכן משותפות לשדכנים ═════════════════════════════════
-- 20260915120000 השאירה רק "Student_notes select own". הלקוח הפך את ההחלטה:
-- הערה של שדכן/מנהל (author_role = 'shadchan'|'admin') גלויה לכל שדכן ולכל
-- מנהל, גם הערות שנכתבו לפני המעבר. הערות איש צוות (author_role = 'staff')
-- לא נוגעים בהן: הן נקראות רק דרך get_student_staff_feedback (ולכותב עצמו).
-- בעל הכרטיס, הורים, צופה לא מחובר ואיש צוות לא רואים הערות שדכן.
-- INSERT / UPDATE / DELETE וטריגר נעילת הסיווג נשארים כמות שהם
-- (UPDATE/DELETE: הכותב או מנהל).
DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'student_notes' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.student_notes', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "Student_notes select own" ON public.student_notes
  FOR SELECT TO authenticated
  USING (author_id = (SELECT auth.uid()));

COMMENT ON POLICY "Student_notes select own" ON public.student_notes
  IS 'כל כותב רואה את ההערות שכתב בעצמו (כולל פידבק צוות שלו). פידבק צוות של אחרים נקרא דרך get_student_staff_feedback';

CREATE POLICY "Student_notes select shadchan notes for shadchanim" ON public.student_notes
  FOR SELECT TO authenticated
  USING (
    author_role IN ('shadchan', 'admin')
    AND public.is_shadchan_or_admin()
  );

COMMENT ON POLICY "Student_notes select shadchan notes for shadchanim" ON public.student_notes
  IS 'הערות שדכן/מנהל גלויות לכל השדכנים והמנהלים - ולא לאיש צוות, לבעל הכרטיס או לצופה ציבורי';

-- שם הכותב: ל-user_profiles יש מדיניות קריאה צרה (עצמי / שותף לשיחה), ולכן
-- השם נשלף בפונקציה שבודקת בעצמה שהקורא שדכן/מנהל - אותו דפוס כמו
-- get_student_staff_feedback. מוחזר גם author_id כדי שהממשק יידע אילו
-- הערות ניתנות לעריכה; לא מוחזרים אימייל או טלפון.
CREATE OR REPLACE FUNCTION public.get_student_shadchan_notes(p_student_id uuid)
RETURNS TABLE (
  id          uuid,
  body        text,
  created_at  timestamptz,
  updated_at  timestamptz,
  author_id   uuid,
  author_name text
)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  SELECT
    n.id,
    n.body,
    n.created_at,
    n.updated_at,
    n.author_id,
    NULLIF(BTRIM(CONCAT_WS(' ',
      COALESCE(NULLIF(BTRIM(p.first_name), ''), NULLIF(BTRIM(u.raw_user_meta_data->>'firstName'), '')),
      COALESCE(NULLIF(BTRIM(p.last_name), ''),  NULLIF(BTRIM(u.raw_user_meta_data->>'lastName'), ''))
    )), '')
  FROM public.student_notes n
  JOIN public.students s ON s.id = n.student_id AND s.deleted_at IS NULL
  LEFT JOIN auth.users u ON u.id = n.author_id
  LEFT JOIN public.user_profiles p ON p.id = n.author_id
  WHERE n.student_id = p_student_id
    AND n.author_role IN ('shadchan', 'admin')
    AND public.is_shadchan_or_admin()
  ORDER BY n.created_at DESC;
$$;

ALTER FUNCTION public.get_student_shadchan_notes(uuid) OWNER TO postgres;

COMMENT ON FUNCTION public.get_student_shadchan_notes(uuid)
  IS 'הערות שדכן על כרטיס עם שם הכותב. מחזירה שורות רק לשדכן/מנהל מחובר.';

REVOKE ALL ON FUNCTION public.get_student_shadchan_notes(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_student_shadchan_notes(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_student_shadchan_notes(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_shadchan_notes(uuid) TO service_role;

-- ══ ב. מודעת אירוסין אוטומטית משידוך שנסגר ═════════════════════════
ALTER TABLE public.engagements
  ADD COLUMN IF NOT EXISTS shidduch_id       uuid REFERENCES public.shidduchim(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS groom_student_id  uuid REFERENCES public.students(id)   ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bride_student_id  uuid REFERENCES public.students(id)   ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source            text NOT NULL DEFAULT 'public_form';

-- UNIQUE על shidduch_id הוא מנגנון האידמפוטנטיות: מודעה אחת לכל הצעה, וכמה
-- שורות NULL (מודעות ידניות/מהטופס) מותרות. הכתיבה מהשרת היא
-- INSERT ... ON CONFLICT (shidduch_id) DO NOTHING.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'engagements_shidduch_id_key'
  ) THEN
    ALTER TABLE public.engagements
      ADD CONSTRAINT engagements_shidduch_id_key UNIQUE (shidduch_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'engagements_source_check'
  ) THEN
    ALTER TABLE public.engagements
      ADD CONSTRAINT engagements_source_check
      CHECK (source IN ('public_form', 'admin', 'system'));
  END IF;
END $$;

COMMENT ON COLUMN public.engagements.source
  IS 'public_form = הטופס באתר (גם שורות ישנות), admin = נוצרה ידנית בעמוד הניהול, system = נוצרה אוטומטית כששידוך הושלם במערכת';

-- הטופס הציבורי פתוח גם לאנונימי: בלי הסגירה כאן אפשר היה להכניס שורה
-- שמתחזה ל"נוצר אוטומטית מהמערכת" או מקושרת לכרטיסים. מנהל כותב דרך
-- engagements_admin_all, והשרת (service role) עוקף RLS.
DROP POLICY IF EXISTS "engagements_public_insert" ON public.engagements;
CREATE POLICY "engagements_public_insert" ON public.engagements
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    is_published = false
    AND source = 'public_form'
    AND shidduch_id IS NULL
    AND groom_student_id IS NULL
    AND bride_student_id IS NULL
  );
