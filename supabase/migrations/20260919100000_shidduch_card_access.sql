-- גישת מנהל כרטיס (הורה) לכרטיס הצד השני בהצעת שידוך.
--
-- רקע: עד כה מנהל כרטיס שקיבל הצעה ראה רק שם, גיל ועיר של הצד השני
-- (get_my_shidduch_proposals), כי מדיניות ה-SELECT על students מתירה קריאה
-- רק לבעל הכרטיס, לשדכן/מנהל ולאיש צוות של המוסד. כאן נפתח מסלול רביעי:
-- מי שנשלחה אליו הצעה רואה את הכרטיס המלא של הצד המוצע.
--
-- מה לא נחשף כברירת מחדל:
--   * פרטי התקשרות (טלפון, ת.ז., רחוב/בית, קו״ח, טלפוני הורים וממליצים) -
--     יצירת הקשר עוברת דרך השדכן. אלה עמודות באותה שורה, ולכן הן נחתכות
--     בשכבת האפליקציה (PROPOSAL_STUDENT_SELECT) ולא ב-RLS, שהוא ברמת שורה.
--   * הצהרה רפואית - טבלה נפרדת, ולכן נחסמת כאן ב-RLS.
-- השדכן יכול לפתוח כל אחד משניהם לשידוך מסוים דרך שתי העמודות החדשות.
--
-- הגישה נשארת גם אחרי שההצעה נסגרה או נדחתה: מי שכבר ראה את הכרטיס אינו
-- "שוכח" אותו, וחסימה בדיעבד רק שוברת קישורים שעבדו. מחיקת רשומת השידוך
-- מסירה את הגישה.
--
-- אידמפוטנטית - ניתן להריץ שוב על סביבה שכבר הוחלה עליה בלי שגיאה.

-- ── בחירת השדכן מה ההורים יראו ────────────────────────────────────
ALTER TABLE public.shidduchim
  ADD COLUMN IF NOT EXISTS share_contact_details boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_medical_info    boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.shidduchim.share_contact_details IS 'השדכן אישר שמנהלי הכרטיסים יראו גם פרטי התקשרות (טלפון, ת.ז., כתובת, קו״ח) בכרטיס הצד השני';
COMMENT ON COLUMN public.shidduchim.share_medical_info    IS 'השדכן אישר שמנהלי הכרטיסים יראו גם את ההצהרה הרפואית של הצד השני';

-- ── מי רואה את מי ─────────────────────────────────────────────────
-- "הצד שלי" הוא הכרטיס שהמשתמש מנהל, "הצד השני" הוא הכרטיס הנבדק,
-- וה-scope חייב לכלול את הצד שלי - אחרת ההצעה מעולם לא נשלחה אליי.
--
-- שני הענפים כתובים כהשוואה ישירה (sh.bride_id = sid / sh.groom_id = sid)
-- ולא דרך CROSS JOIN LATERAL כמו ב-get_my_shidduch_proposals: הפונקציה
-- הזו רצה בתוך מדיניות RLS, כלומר פעם לכל שורה בטבלת המיועדים, ורק בצורה
-- הזו היא יכולה להשתמש ב-idx_shidduchim_groom_id ו-idx_shidduchim_bride_id
-- במקום לסרוק את טבלת השידוכים מחדש בכל שורה.
CREATE OR REPLACE FUNCTION public.shidduch_reveals_student(uid uuid, sid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  SELECT uid IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.shidduchim sh
    JOIN public.students me
      ON me.user_id = uid
     AND me.deleted_at IS NULL
    WHERE sh.status <> 'draft'
      AND (
        -- הכרטיס הנבדק הוא המיועדת, ואני מנהל את כרטיס המיועד
        (sh.bride_id = sid AND me.id = sh.groom_id
         AND sh.recipient_scope IN ('both', 'groom_only'))
        OR
        -- או להפך
        (sh.groom_id = sid AND me.id = sh.bride_id
         AND sh.recipient_scope IN ('both', 'bride_only'))
      )
  );
$$;

ALTER FUNCTION public.shidduch_reveals_student(uuid, uuid) OWNER TO postgres;

COMMENT ON FUNCTION public.shidduch_reveals_student(uuid, uuid)
  IS 'בודק אם המשתמש מנהל כרטיס שנשלחה אליו הצעת שידוך שהמיועד/ת הנתון/ה הוא/היא הצד השני בה';

REVOKE ALL ON FUNCTION public.shidduch_reveals_student(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.shidduch_reveals_student(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.shidduch_reveals_student(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shidduch_reveals_student(uuid, uuid) TO service_role;

-- אותו תנאי, בתוספת הדגל שהשדכן סימן. פונקציה נפרדת ולא פרמטר, כדי
-- שמדיניות ה-RLS על medical_records תישאר קריאה כמו כל האחרות.
CREATE OR REPLACE FUNCTION public.shidduch_reveals_medical(uid uuid, sid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  SELECT uid IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.shidduchim sh
    JOIN public.students me
      ON me.user_id = uid
     AND me.deleted_at IS NULL
    WHERE sh.status <> 'draft'
      AND sh.share_medical_info
      AND (
        (sh.bride_id = sid AND me.id = sh.groom_id
         AND sh.recipient_scope IN ('both', 'groom_only'))
        OR
        (sh.groom_id = sid AND me.id = sh.bride_id
         AND sh.recipient_scope IN ('both', 'bride_only'))
      )
  );
$$;

ALTER FUNCTION public.shidduch_reveals_medical(uuid, uuid) OWNER TO postgres;

COMMENT ON FUNCTION public.shidduch_reveals_medical(uuid, uuid)
  IS 'כמו shidduch_reveals_student, אבל רק כשהשדכן פתח את ההצהרה הרפואית לאותה הצעה';

REVOKE ALL ON FUNCTION public.shidduch_reveals_medical(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.shidduch_reveals_medical(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.shidduch_reveals_medical(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shidduch_reveals_medical(uuid, uuid) TO service_role;

-- ── מדיניות הקריאה על students ────────────────────────────────────
-- שם המדיניות נשמר (ראו 20260830170000_student_notes.sql) כדי לא לשבור
-- הפניות קיימות אליה.
DROP POLICY IF EXISTS "Users can view own profile or shadchanim see all" ON public.students;
CREATE POLICY "Users can view own profile or shadchanim see all"
  ON public.students FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      auth.uid() = user_id
      OR public.is_shadchan_or_admin()
      OR public.staff_can_access_student(auth.uid(), id)
      OR public.shidduch_reveals_student(auth.uid(), id)
    )
  );

-- ── מדיניות הקריאה על טבלאות הבן ──────────────────────────────────
-- המקטעים האלה הם גוף הכרטיס (השכלה, תעסוקה, משפחה קודמת, העדפות,
-- ממליצים), ובלעדיהם "כרטיס מלא" הוא כותרת ריקה.
DROP POLICY IF EXISTS "Users read own students or shadchanim see all" ON public.education_history;
CREATE POLICY "Users read own students or shadchanim see all"
  ON public.education_history FOR SELECT
  USING (
    public.is_shadchan_or_admin()
    OR public.shidduch_reveals_student(auth.uid(), student_id)
    OR EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = education_history.student_id AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users read own students or shadchanim see all" ON public.employment_history;
CREATE POLICY "Users read own students or shadchanim see all"
  ON public.employment_history FOR SELECT
  USING (
    public.is_shadchan_or_admin()
    OR public.shidduch_reveals_student(auth.uid(), student_id)
    OR EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = employment_history.student_id AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users read own students or shadchanim see all" ON public.partner_preferences;
CREATE POLICY "Users read own students or shadchanim see all"
  ON public.partner_preferences FOR SELECT
  USING (
    public.is_shadchan_or_admin()
    OR public.shidduch_reveals_student(auth.uid(), student_id)
    OR EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = partner_preferences.student_id AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users read own students or shadchanim see all" ON public.previous_partners;
CREATE POLICY "Users read own students or shadchanim see all"
  ON public.previous_partners FOR SELECT
  USING (
    public.is_shadchan_or_admin()
    OR public.shidduch_reveals_student(auth.uid(), student_id)
    OR EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = previous_partners.student_id AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users read own students or shadchanim see all" ON public."references";
CREATE POLICY "Users read own students or shadchanim see all"
  ON public."references" FOR SELECT
  USING (
    public.is_shadchan_or_admin()
    OR public.shidduch_reveals_student(auth.uid(), student_id)
    OR EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = "references".student_id AND s.user_id = auth.uid()
    )
  );

-- ההצהרה הרפואית היא היוצאת מן הכלל: היא נפתחת רק כשהשדכן סימן זאת
-- במפורש לאותה הצעה.
DROP POLICY IF EXISTS "Users read own students or shadchanim see all" ON public.medical_records;
CREATE POLICY "Users read own students or shadchanim see all"
  ON public.medical_records FOR SELECT
  USING (
    public.is_shadchan_or_admin()
    OR public.shidduch_reveals_medical(auth.uid(), student_id)
    OR EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = medical_records.student_id AND s.user_id = auth.uid()
    )
  );

-- ── מה מותר לצופה הנוכחי ──────────────────────────────────────────
-- מקור אמת אחד לשכבת האפליקציה: היא חייבת לדעת *לפני* השאילתה אילו
-- עמודות מותר בכלל לשלוף, כי Server Component מסדרר כל מה שנשלף לתוך
-- ה-HTML. ראו ההערה ב-features/students/lib/student-card-data.ts.
CREATE OR REPLACE FUNCTION public.get_student_card_access(sid uuid)
RETURNS TABLE (
  access_level  text,
  share_contact boolean,
  share_medical boolean
)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  WITH target AS (
    SELECT s.id, s.user_id
    FROM public.students s
    WHERE s.id = sid AND s.deleted_at IS NULL
  ),
  proposal AS (
    -- bool_or על פני כל ההצעות הרלוונטיות: להורה עם שני ילדים יכולות
    -- להיות שתי הצעות על אותו כרטיס, והדגל הפתוח יותר גובר.
    -- שמות שונים משמות עמודות ה-RETURNS TABLE בכוונה: הפניה לא מוסמכת
    -- לשם זהה הייתה עלולה להיקרא כעמודת פלט ולא כעמודת ה-CTE.
    SELECT
      bool_or(true)                      AS p_has_access,
      bool_or(sh.share_contact_details)  AS p_share_contact,
      bool_or(sh.share_medical_info)     AS p_share_medical
    FROM public.shidduchim sh
    JOIN public.students me
      ON me.user_id = auth.uid()
     AND me.deleted_at IS NULL
    WHERE sh.status <> 'draft'
      AND (
        (sh.bride_id = sid AND me.id = sh.groom_id
         AND sh.recipient_scope IN ('both', 'groom_only'))
        OR
        (sh.groom_id = sid AND me.id = sh.bride_id
         AND sh.recipient_scope IN ('both', 'bride_only'))
      )
  )
  SELECT
    CASE
      WHEN auth.uid() IS NULL THEN 'none'
      WHEN NOT EXISTS (SELECT 1 FROM target) THEN 'none'
      -- בעל הכרטיס, שדכן/מנהל ואיש צוות של המוסד רואים הכול ממילא,
      -- וקדימותם כאן מונעת הצרה מקרית של כרטיס שהם מורשים לו במלואו.
      WHEN (SELECT user_id FROM target) = auth.uid()
        OR public.is_shadchan_or_admin()
        OR public.staff_can_access_student(auth.uid(), sid) THEN 'full'
      WHEN COALESCE((SELECT p_has_access FROM proposal), false) THEN 'proposal'
      ELSE 'none'
    END,
    COALESCE((SELECT p_share_contact FROM proposal), false),
    COALESCE((SELECT p_share_medical FROM proposal), false);
$$;

ALTER FUNCTION public.get_student_card_access(uuid) OWNER TO postgres;

COMMENT ON FUNCTION public.get_student_card_access(uuid)
  IS 'רמת הגישה של המשתמש המחובר לכרטיס נתון (none/proposal/full) ומה נפתח לו בהצעה';

REVOKE ALL ON FUNCTION public.get_student_card_access(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_student_card_access(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_student_card_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_card_access(uuid) TO service_role;
