-- "מדוע מילאתי" וסיבת הדחייה לא נקראים על ידי שדכנים (ממצא 20, החלטת מוצר).
--
-- שדכן קורא את שורת students במלואה (select *). ה-UI כבר מסיר את
-- author_info.fillReason בשרת, אבל קריאה ישירה מהדפדפן עם המפתח הציבורי
-- החזירה אותו. עמודה ב-RLS אי אפשר להסתיר לפי צופה, ולכן:
--
-- 1. fillReason עובר לטבלה student_private, שרק בעל הכרטיס ומנהל קוראים.
--    trigger מוציא אותו מ-author_info בכל כתיבה. ערך שכותב מי שאינו בעלים
--    או מנהל (שדכן שעורך כרטיס ואינו רואה את ההסבר) לא נשמר, כדי שעריכה
--    שלו לא תמחק את ההסבר.
-- 2. סיבת הדחייה לא דורשת שינוי: היא קיימת רק בכרטיס שנדחה, שאינו מאושר
--    (students_admin_approval_state_check), וכרטיס כזה חסום לשדכן במדיניות
--    RESTRICTIVE. ה-view מחזיר אותה רק לבעלים ולמנהל.
--
-- ROLLBACK (להחזיר את ההסבר ל-author_info):
--   DROP TRIGGER trigger_stash_student_private_fields ON public.students;
--   UPDATE public.students s SET author_info = s.author_info || jsonb_build_object('fillReason', p.fill_reason)
--     FROM public.student_private p WHERE p.student_id = s.id AND p.fill_reason IS NOT NULL
--       AND jsonb_typeof(s.author_info) = 'object';
--   DROP TABLE public.student_private;

-- ── 1. הטבלה ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.student_private (
  -- DEFERRABLE: ה-trigger כותב כאן לפני שהשורה ב-students קיימת (INSERT)
  student_id  uuid PRIMARY KEY
              REFERENCES public.students(id) ON DELETE CASCADE
              DEFERRABLE INITIALLY DEFERRED,
  fill_reason text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.student_private OWNER TO postgres;
ALTER TABLE public.student_private ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.student_private FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.student_private TO authenticated;
GRANT ALL ON public.student_private TO service_role;

DROP POLICY IF EXISTS "Student private fields are read by owner and admin" ON public.student_private;
CREATE POLICY "Student private fields are read by owner and admin" ON public.student_private
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_admin())
    OR EXISTS (
      SELECT 1 FROM public.students s
       WHERE s.id = student_private.student_id
         AND s.user_id = (SELECT auth.uid())
    )
  );

-- ── 2. העברת הנתונים הקיימים ────────────────────────────────────────
INSERT INTO public.student_private (student_id, fill_reason)
SELECT s.id, NULLIF(btrim(s.author_info->>'fillReason'), '')
  FROM public.students s
 WHERE jsonb_typeof(s.author_info) = 'object'
   AND s.author_info ? 'fillReason'
   AND NULLIF(btrim(s.author_info->>'fillReason'), '') IS NOT NULL
ON CONFLICT (student_id) DO UPDATE SET fill_reason = EXCLUDED.fill_reason, updated_at = now();

-- ── 3. כתיבה: ההסבר יוצא מ-author_info ───────────────────────────────
CREATE OR REPLACE FUNCTION public.stash_student_private_fields() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_reason text;
BEGIN
  IF NEW.author_info IS NULL
     OR jsonb_typeof(NEW.author_info) <> 'object'
     OR NOT (NEW.author_info ? 'fillReason') THEN
    RETURN NEW;
  END IF;

  v_reason := NULLIF(btrim(NEW.author_info->>'fillReason'), '');
  NEW.author_info := NEW.author_info - 'fillReason';

  -- service role (v_uid NULL), בעל הכרטיס או מנהל בלבד
  IF v_uid IS NOT NULL
     AND v_uid IS DISTINCT FROM NEW.user_id
     AND NOT COALESCE(public.is_admin(), false) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.student_private (student_id, fill_reason)
  VALUES (NEW.id, v_reason)
  ON CONFLICT (student_id) DO UPDATE
    SET fill_reason = EXCLUDED.fill_reason, updated_at = now();
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.stash_student_private_fields() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.stash_student_private_fields() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trigger_stash_student_private_fields ON public.students;
CREATE TRIGGER trigger_stash_student_private_fields
  BEFORE INSERT OR UPDATE OF author_info ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.stash_student_private_fields();

-- ההסבר יוצא מהשורות הקיימות (אחרי ההעברה; ה-trigger לא משנה את הטבלה
-- הפרטית כאן, כי ה-UPDATE רץ ב-service role והערך כבר הועבר)
UPDATE public.students
   SET author_info = author_info - 'fillReason'
 WHERE jsonb_typeof(author_info) = 'object'
   AND author_info ? 'fillReason';

NOTIFY pgrst, 'reload schema';
