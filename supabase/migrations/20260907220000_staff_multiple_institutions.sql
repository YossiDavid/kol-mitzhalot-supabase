-- איש צוות יכול להשתייך ליותר ממוסד אחד, עם תפקיד נפרד בכל מוסד.
--
-- עד כה staff_info החזיק institution_id ו-position יחידים, ולכן גם
-- staff_can_access_student נבנה על מוסד אחד. שתי העמודות נשארות
-- בטבלה לתאימות לאחור ומקבלות backfill לטבלה החדשה, אבל מקור האמת
-- לגישה הוא מעכשיו staff_institutions.
--
-- אידמפוטנטית — ניתן להריץ שוב.

-- ── טבלת השיוכים ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.staff_institutions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  position       text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  -- אותו אדם לא משויך פעמיים לאותו מוסד
  UNIQUE (user_id, institution_id)
);

COMMENT ON TABLE  public.staff_institutions          IS 'שיוך איש צוות למוסדות לימוד, עם תפקיד לכל מוסד';
COMMENT ON COLUMN public.staff_institutions.position IS 'התפקיד באותו מוסד ספציפי';

CREATE INDEX IF NOT EXISTS idx_staff_institutions_user_id
  ON public.staff_institutions (user_id);
CREATE INDEX IF NOT EXISTS idx_staff_institutions_institution_id
  ON public.staff_institutions (institution_id);

-- ── העברת השיוך היחיד הקיים ──────────────────────────────────────
INSERT INTO public.staff_institutions (user_id, institution_id, position)
SELECT si.user_id, si.institution_id, si.position
FROM public.staff_info si
WHERE si.institution_id IS NOT NULL
ON CONFLICT (user_id, institution_id) DO NOTHING;

-- ── RLS ───────────────────────────────────────────────────────────
ALTER TABLE public.staff_institutions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff_institutions select own or admin" ON public.staff_institutions;
CREATE POLICY "Staff_institutions select own or admin" ON public.staff_institutions
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "Staff_institutions insert own or admin" ON public.staff_institutions;
CREATE POLICY "Staff_institutions insert own or admin" ON public.staff_institutions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "Staff_institutions update own or admin" ON public.staff_institutions;
CREATE POLICY "Staff_institutions update own or admin" ON public.staff_institutions
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin())
  WITH CHECK (user_id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "Staff_institutions delete own or admin" ON public.staff_institutions;
CREATE POLICY "Staff_institutions delete own or admin" ON public.staff_institutions
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin());

GRANT ALL ON TABLE public.staff_institutions TO anon;
GRANT ALL ON TABLE public.staff_institutions TO authenticated;
GRANT ALL ON TABLE public.staff_institutions TO service_role;

-- ── הרחבת הגישה לכל המוסדות של איש הצוות ─────────────────────────
-- שים לב: אישור הבקשה עדיין נשמר ב-staff_info.application_status,
-- ולכן התנאי נשאר שם. staff_institutions קובע רק לאילו מוסדות.
CREATE OR REPLACE FUNCTION public.staff_can_access_student(uid uuid, sid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.students s
    JOIN public.staff_institutions sinst
      ON sinst.institution_id = s.institution_id
    JOIN public.staff_info si
      ON si.user_id = sinst.user_id
    WHERE s.id = sid
      AND s.deleted_at IS NULL
      AND sinst.user_id = uid
      AND si.application_status = 'approved'
  );
$$;

ALTER FUNCTION public.staff_can_access_student(uuid, uuid) OWNER TO postgres;
COMMENT ON FUNCTION public.staff_can_access_student(uuid, uuid)
  IS 'האם איש צוות מאושר משויך למוסד של המיועד. בודק את כל מוסדותיו.';

GRANT ALL ON FUNCTION public.staff_can_access_student(uuid, uuid) TO anon;
GRANT ALL ON FUNCTION public.staff_can_access_student(uuid, uuid) TO authenticated;
GRANT ALL ON FUNCTION public.staff_can_access_student(uuid, uuid) TO service_role;
