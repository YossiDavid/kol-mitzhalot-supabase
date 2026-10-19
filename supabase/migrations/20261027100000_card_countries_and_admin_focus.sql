-- שדות חדשים בכרטיס וסימון "במיקוד" של ההנהלה (תוספת בלבד, בטוח להחיל לפני
-- הקוד).
--
--   1. students.willing_to_live_countries: "מוכן/ה לגור ב:" - רשימת ארצות.
--      NULL = לא צוין (כרטיסים ישנים).
--   2. student_admin_focus: כרטיס שההנהלה סימנה "במיקוד", עם הערה קצרה. טבלה
--      נפרדת ולא עמודות ב-students: את שורת students קורא גם בעל הכרטיס, וההערה
--      של ההנהלה מיועדת לשדכנים ולמנהלים בלבד. אין לה הרשאות ללקוחות כלל:
--      כותב רק service role (נתיב המנהל), וקוראים דרך student_cards.
--   3. student_cards: is_kohen (מ-20261027090000), willing_to_live_countries,
--      admin_focus_at ו-admin_focus_note - בסוף רשימת העמודות (CREATE OR
--      REPLACE VIEW אינו משנה סדר). המיקוד מוחזר לשדכן ולמנהל בלבד.
-- דורש את 20261027090000_students_is_kohen.sql.
-- אידמפוטנטית. להחלה: psql --single-transaction -v ON_ERROR_STOP=1 -f <file>

-- ── 1. מוכן/ה לגור ב ─────────────────────────────────────────────────
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS willing_to_live_countries text[];

COMMENT ON COLUMN public.students.willing_to_live_countries IS
  'הארצות שהמיועד/ת מוכן/ה לגור בהן. NULL = לא צוין';

-- ── 2. במיקוד ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.student_admin_focus (
  student_id uuid PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE,
  focused_at timestamptz NOT NULL DEFAULT now(),
  focused_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text CHECK (note IS NULL OR char_length(note) <= 200)
);

COMMENT ON TABLE public.student_admin_focus IS
  'כרטיסים שהנהלת המערכת סימנה "במיקוד". כותב רק service role (PATCH /api/v1/students/:id/admin-focus); נקרא דרך student_cards, לשדכנים ולמנהלים בלבד';

ALTER TABLE public.student_admin_focus ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.student_admin_focus FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.student_admin_focus TO service_role;

-- ── 3. student_cards ─────────────────────────────────────────────────
-- הגוף מ-20261019100000_card_admin_approval_gate.sql בלי שינוי; העמודות החדשות
-- והצירוף ל-student_admin_focus מסומנים.
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
    CASE WHEN r.is_restricted THEN NULL ELSE s.plan_for_life END AS plan_for_life,
    CASE WHEN r.is_restricted THEN NULL ELSE s.head_cover_type END AS head_cover_type,
    CASE WHEN r.is_restricted THEN NULL ELSE s.proposal_limit_count END AS proposal_limit_count,
    CASE WHEN r.is_restricted THEN NULL ELSE s.proposal_limit_period END AS proposal_limit_period,
    CASE WHEN r.is_restricted THEN NULL ELSE s.admin_paused_at END AS admin_paused_at,
    CASE WHEN r.is_restricted THEN NULL ELSE s.third_party_full_display_approved_by END
      AS third_party_full_display_approved_by,
    CASE WHEN r.is_restricted THEN NULL ELSE s.third_party_proposals_approved_by END
      AS third_party_proposals_approved_by,
    CASE WHEN r.is_restricted THEN jsonb_build_object(
      'father', jsonb_build_object('self', s.parents_info->'father'->'self'),
      'mother', jsonb_build_object('self', s.parents_info->'mother'->'self')
    ) ELSE s.parents_info END AS parents_info,
    CASE WHEN r.is_restricted AND jsonb_typeof(s.author_info) = 'object'
         THEN s.author_info - 'fillReason'
         ELSE s.author_info END AS author_info,
    s.admin_approved_at,
    CASE WHEN (SELECT auth.uid()) = s.user_id OR (SELECT public.is_admin())
         THEN s.admin_rejected_at END AS admin_rejected_at,
    CASE WHEN (SELECT auth.uid()) = s.user_id OR (SELECT public.is_admin())
         THEN s.admin_rejection_reason END AS admin_rejection_reason,
    -- חדש: כהן (פרט בסיסי, כמו הסטטוס האישי) ומוכן/ה לגור ב
    s.is_kohen,
    CASE WHEN r.is_restricted THEN NULL ELSE s.willing_to_live_countries END
      AS willing_to_live_countries,
    -- חדש: סימון "במיקוד" של ההנהלה - לשדכן ולמנהל בלבד (לא לבעל הכרטיס)
    CASE WHEN (SELECT public.is_shadchan_or_admin()) THEN f.focused_at END
      AS admin_focus_at,
    CASE WHEN (SELECT public.is_shadchan_or_admin()) THEN f.note END
      AS admin_focus_note
  FROM public.students s
  CROSS JOIN LATERAL (
    SELECT (
      s.card_for = 'other'
      AND s.third_party_full_display_approved_at IS NULL
      AND public.student_display_restricted(s.id)
    ) IS TRUE AS is_restricted
  ) r
  LEFT JOIN public.student_admin_focus f ON f.student_id = s.id
  WHERE s.deleted_at IS NULL
    AND (
      (SELECT auth.uid()) = s.user_id
      OR (SELECT public.is_shadchan_or_admin())
      OR public.staff_can_access_student((SELECT auth.uid()), s.id)
    )
    -- כרטיס שהנהלת המערכת לא אישרה: בעליו ומנהל בלבד
    AND (
      s.admin_approved_at IS NOT NULL
      OR (SELECT auth.uid()) = s.user_id
      OR (SELECT public.is_admin())
    );

ALTER VIEW public.student_cards OWNER TO postgres;
REVOKE ALL ON public.student_cards FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.student_cards TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ── rollback ─────────────────────────────────────────────────────────
-- בטוח רק כשהקוד שקורא את העמודות החדשות אינו באוויר. הסימונים והארצות נמחקים.
--   DROP VIEW IF EXISTS public.student_cards;
--   -- ...ואז להריץ שוב את החלק של student_cards מתוך 20261019100000_card_admin_approval_gate.sql
--   DROP TABLE IF EXISTS public.student_admin_focus;
--   ALTER TABLE public.students DROP COLUMN IF EXISTS willing_to_live_countries;
--   NOTIFY pgrst, 'reload schema';
