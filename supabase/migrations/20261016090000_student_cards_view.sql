-- כרטיס צד שלישי שלא אושר להצגה מלאה, שלב 1 מתוך 2 (תוספת בלבד, בטוח להחיל
-- לפני הקוד).
--
-- עד היום שדכן או איש צוות שרואה את שורת students של כרטיס כזה יכול היה לקרוא
-- ישירות דרך PostgREST את כל העמודות שלה (about, family_info, טלפון, כתובת,
-- ת.ז. ועוד) - האפליקציה הסתירה אותן רק בבחירת ה-select. RLS חוסם שורות ולא
-- עמודות, ולכן הפתרון הוא בשני שלבים:
--   שלב 1 (כאן): student_cards - "הכרטיס כפי שמותר להציג אותו ברשימות". אותן
--     שורות שהצופה רואה ב-students, ברשימת עמודות מפורשת, ובכרטיס מוגבל
--     (student_display_restricted) רק הנתונים הבסיסיים: כל עמודה אחרת ריקה,
--     parents_info מצטמצם לשמות ההורים ו-author_info בלי ההסבר של הממלא.
--   שלב 2 (20261016100000_third_party_row_gate.sql): שורת students של כרטיס
--     מוגבל אינה נקראת ישירות על ידי מי שאינו הבעלים או מנהל. להחיל רק אחרי
--     שהקוד שקורא רשימות דרך student_cards עלה לאוויר.
--
-- עמודה חדשה ב-students אינה מופיעה ב-view עד שתתווסף כאן במפורש, ואינה
-- נקראת ישירות בכרטיס מוגבל (השורה כולה חסומה) - סגור כברירת מחדל.
-- אידמפוטנטית. להחלה: psql --single-transaction -v ON_ERROR_STOP=1 -f <file>

-- ה-view רץ בהרשאות הבעלים (postgres) כדי לראות גם את השורות ששלב 2 חוסם,
-- ולכן תנאי הנראות של students (המדיניות "Users can view own profile or
-- shadchanim see all") חוזר כאן. third-party-column-gate.spec.ts משווה את שני
-- הנוסחים, כך ששינוי במדיניות בלי שינוי כאן מפיל את הבדיקה.
-- security_barrier: סינון של המשתמש (ilike וכו') אינו מוערך לפני תנאי הנראות.
CREATE OR REPLACE VIEW public.student_cards
  WITH (security_barrier = true, security_invoker = false)
  AS
  SELECT
    s.id,
    s.user_id,
    s.created_at,
    s.first_name,
    s.last_name,
    s.nickname,
    s.gender,
    s.personal_status,
    s.birth_date,
    s.height,
    s.country,
    s.city,
    s.community,
    s.shtible,
    s.cellphone_type,
    s.cv_url,
    s.in_shidduchim,
    s.status_changed_at,
    s.is_yeshiva,
    s.photo_count,
    s.institution_id,
    s.deleted_at,
    s.card_for,
    s.third_party_full_display_approved_at,
    s.third_party_proposals_approved_at,
    -- מכאן: עמודות שמחוץ לנתונים הבסיסיים. בכרטיס מוגבל הן ריקות.
    CASE WHEN r.is_restricted THEN NULL ELSE s.plan_for_life END AS plan_for_life,
    CASE WHEN r.is_restricted THEN NULL ELSE s.head_cover_type END AS head_cover_type,
    CASE WHEN r.is_restricted THEN NULL ELSE s.proposal_limit_count END AS proposal_limit_count,
    CASE WHEN r.is_restricted THEN NULL ELSE s.proposal_limit_period END AS proposal_limit_period,
    CASE WHEN r.is_restricted THEN NULL ELSE s.admin_paused_at END AS admin_paused_at,
    CASE WHEN r.is_restricted THEN NULL ELSE s.third_party_full_display_approved_by END
      AS third_party_full_display_approved_by,
    CASE WHEN r.is_restricted THEN NULL ELSE s.third_party_proposals_approved_by END
      AS third_party_proposals_approved_by,
    -- שמות ההורים בלבד בכרטיס מוגבל (בלי עיסוק, טלפון, מצב משפחתי)
    CASE WHEN r.is_restricted THEN jsonb_build_object(
      'father', jsonb_build_object('self', s.parents_info->'father'->'self'),
      'mother', jsonb_build_object('self', s.parents_info->'mother'->'self')
    ) ELSE s.parents_info END AS parents_info,
    -- פרטי הממלא הם חלק מהנתונים הבסיסיים; ההסבר "מדוע מילאתי" - לא
    CASE WHEN r.is_restricted AND jsonb_typeof(s.author_info) = 'object'
         THEN s.author_info - 'fillReason'
         ELSE s.author_info END AS author_info
  FROM public.students s
  CROSS JOIN LATERAL (
    -- שני התנאים הראשונים נגזרים מהכלל עצמו ורק חוסכים את הקריאה לפונקציה
    -- בכרטיסים שאינם צד שלישי ממתין; ההכרעה היא של student_display_restricted.
    SELECT (
      s.card_for = 'other'
      AND s.third_party_full_display_approved_at IS NULL
      AND public.student_display_restricted(s.id)
    ) IS TRUE AS is_restricted
  ) r
  WHERE s.deleted_at IS NULL
    AND (
      (SELECT auth.uid()) = s.user_id
      OR (SELECT public.is_shadchan_or_admin())
      OR public.staff_can_access_student((SELECT auth.uid()), s.id)
    );

ALTER VIEW public.student_cards OWNER TO postgres;

COMMENT ON VIEW public.student_cards IS
  'כרטיסי המיועדים לרשימות ולתצוגה הבסיסית: השורות שהצופה רשאי לראות, בעמודות מפורשות; כרטיס צד שלישי שלא אושר להצגה מלאה מוחזר עם הנתונים הבסיסיים בלבד';

-- קריאה בלבד, ולמחוברים בלבד (ברירת המחדל של Supabase מעניקה הכול לכל התפקידים)
REVOKE ALL ON public.student_cards FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.student_cards TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ── rollback ─────────────────────────────────────────────────────────
-- בטוח רק כשהקוד שקורא מ-student_cards אינו באוויר, ואחרי rollback של שלב 2.
--
--   DROP VIEW IF EXISTS public.student_cards;
--   NOTIFY pgrst, 'reload schema';
