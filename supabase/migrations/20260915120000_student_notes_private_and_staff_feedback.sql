-- הפרדת "הערות שדכן" מ"פידבק אנשי צוות".
--
-- רקע: עד כה student_notes הוצגו כמקטע אחד "מחמאות והערות", וכל שדכן ומנהל
-- קראו את כל ההערות - גם הערות עבודה של שדכנים אחרים. הלקוח ביקש:
--   • "הערות שדכן" - לעיני השדכן שכתב אותן בלבד, ולא בשיתוף הכרטיס.
--   • "פידבק אנשי צוות" - מחמאות וחוות דעת של אנשי חינוך, שכן מצטרפות
--     בשיתוף הכרטיס (גם לצופה לא מחובר) ומציגות את שם הכותב.
--
-- אין עמודה חדשה: author_role כבר מבחין בין השניים ('staff' = פידבק,
-- 'shadchan'/'admin' = הערת שדכן), והוא נקבע בשרת בזמן הכתיבה.
--
-- אידמפוטנטית - ניתן להריץ שוב.

-- ── 1. קריאה ישירה מהטבלה: רק מה שכתבת בעצמך ─────────────────────
-- מחליף את כל מדיניות ה-SELECT הקיימות (לפי cmd ולא לפי שם, כדי שלא
-- תישאר מדיניות מתירנית ישנה בשם אחר).
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
  IS 'כל כותב רואה רק את ההערות שלו. פידבק אנשי צוות נקרא לכולם דרך get_student_staff_feedback';

-- ── 2. פידבק אנשי צוות - גלוי לכל מי שרואה את הכרטיס ──────────────
-- גם לצופה לא מחובר: עמוד הכרטיס הציבורי (קישור השיתוף) פתוח לכל מזהה
-- כרטיס שלא נמחק, והפידבק הוא חלק מהשיתוף לבקשת הלקוח. מוחזרים רק שם
-- הכותב ומוסדו - לא מזהה המשתמש, אימייל או טלפון.
CREATE OR REPLACE FUNCTION public.get_student_staff_feedback(p_student_id uuid)
RETURNS TABLE (
  id               uuid,
  body             text,
  created_at       timestamptz,
  author_name      text,
  institution_name text,
  institution_city text
)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  SELECT
    n.id,
    n.body,
    n.created_at,
    NULLIF(BTRIM(CONCAT_WS(' ',
      COALESCE(NULLIF(BTRIM(p.first_name), ''), NULLIF(BTRIM(u.raw_user_meta_data->>'firstName'), '')),
      COALESCE(NULLIF(BTRIM(p.last_name), ''),  NULLIF(BTRIM(u.raw_user_meta_data->>'lastName'), ''))
    )), ''),
    i.name,
    i.city
  FROM public.student_notes n
  JOIN public.students s ON s.id = n.student_id AND s.deleted_at IS NULL
  JOIN auth.users u ON u.id = n.author_id
  LEFT JOIN public.user_profiles p ON p.id = n.author_id
  LEFT JOIN public.institutions i ON i.id = n.author_institution_id
  WHERE n.student_id = p_student_id
    AND n.author_role = 'staff'
  ORDER BY n.created_at DESC;
$$;

ALTER FUNCTION public.get_student_staff_feedback(uuid) OWNER TO postgres;

COMMENT ON FUNCTION public.get_student_staff_feedback(uuid)
  IS 'פידבק אנשי צוות על כרטיס (author_role=staff) עם שם הכותב ומוסדו. גלוי גם בשיתוף הכרטיס.';

REVOKE ALL ON FUNCTION public.get_student_staff_feedback(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_student_staff_feedback(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_student_staff_feedback(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_staff_feedback(uuid) TO service_role;

-- ── 3. נעילת סיווג ההערה בעדכון ────────────────────────────────────
-- מדיניות ה-UPDATE בודקת רק בעלות על השורה, ו-RLS אינו יכול להשוות ערך
-- ישן לחדש. בלי הנעילה כותב יכול היה להפוך הערה פרטית ל-'staff' - ולפרסם
-- אותה בשמו, תחת מוסד כלשהו, על כל כרטיס ולכל צופה - או להסתיר פידבק
-- שכבר פורסם. רק body ניתן לעריכה. פעולות מערכת (בלי auth.uid(), כמו
-- איחוד מוסדות ב-20260908080000) פטורות.
CREATE OR REPLACE FUNCTION public.student_notes_lock_classification() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND (
       NEW.author_role           IS DISTINCT FROM OLD.author_role
    OR NEW.author_institution_id IS DISTINCT FROM OLD.author_institution_id
    OR NEW.student_id            IS DISTINCT FROM OLD.student_id
    OR NEW.author_id             IS DISTINCT FROM OLD.author_id
  ) THEN
    RAISE EXCEPTION 'student_note_classification_locked'
      USING HINT = 'ניתן לערוך רק את תוכן ההערה';
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.student_notes_lock_classification() OWNER TO postgres;

COMMENT ON FUNCTION public.student_notes_lock_classification()
  IS 'מונע שינוי סוג/כותב/מוסד/כרטיס של הערה בעדכון - רק התוכן ניתן לעריכה';

DROP TRIGGER IF EXISTS trigger_student_notes_lock_classification ON public.student_notes;
CREATE TRIGGER trigger_student_notes_lock_classification
  BEFORE UPDATE ON public.student_notes
  FOR EACH ROW EXECUTE FUNCTION public.student_notes_lock_classification();
