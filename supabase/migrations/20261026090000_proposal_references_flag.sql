-- פרטי הממליצים בהצעה: בחירה של השדכן, לכל הצעה בנפרד (תוספת בלבד, בטוח
-- להחיל לפני הקוד).
--
-- החלטת הלקוח: "חשוב לאפשר שהממליצים יעברו במסגרת שליחת הצעה לצד השני".
-- כשהשדכן בוחר "לשתף את פרטי הממליצים", הצד השני רואה את הטלפון והאימייל של
-- הממליצים. פרטי ההתקשרות של המיועד/ת, ההורים והממלא - נשארים חסויים תמיד.
--
-- כאן:
--   1. shidduchim.share_references (ברירת מחדל: סגור).
--   2. get_proposal_card_disclosure: מה נפתח למי שצופה דרך הצעה (קו"ח, ממליצים,
--      והדגל הישן לתאימות). get_proposal_cv_disclosure נשארת כמות שהיא - הקוד
--      שבאוויר קורא לה.
--   3. get_proposal_student_card: מהגרסה של 20261023120000, עם טלפון ואימייל של
--      הממליצים רק כשהדגל פתוח.
-- קוד ישן מול המסד הזה: אינו כותב share_references (תמיד סגור), וה-schema שלו
-- חותך טלפון ואימייל של ממליצים גם אם הגיעו - הכרטיס נטען כמו היום.
-- אידמפוטנטית. להחלה: psql --single-transaction -v ON_ERROR_STOP=1 -f <file>

ALTER TABLE public.shidduchim
  ADD COLUMN IF NOT EXISTS share_references boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.shidduchim.share_references IS
  'השדכן בחר לשתף עם הצד השני את הטלפון והאימייל של הממליצים בהצעה הזו';

CREATE OR REPLACE FUNCTION public.get_proposal_card_disclosure(p_student_id uuid)
    RETURNS TABLE(share_cv boolean, share_references boolean, legacy_share_contact boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  -- שורה אחת למי שרואה את הכרטיס בזכות הצעה, ואפס שורות לכל אחר. bool_or על
  -- פני כל ההצעות שחושפות את הכרטיס: הדגל הפתוח יותר גובר.
  SELECT
    COALESCE(bool_or(sh.share_cv OR sh.share_contact_details), false),
    COALESCE(bool_or(sh.share_references), false),
    COALESCE(bool_or(sh.share_contact_details), false)
  FROM public.get_student_card_access(p_student_id) a
  LEFT JOIN public.students me
    ON me.user_id = auth.uid()
   AND me.deleted_at IS NULL
  LEFT JOIN public.shidduchim sh
    ON sh.status <> 'draft'
   AND (
     (sh.bride_id = p_student_id AND me.id = sh.groom_id
      AND sh.recipient_scope IN ('both', 'groom_only'))
     OR
     (sh.groom_id = p_student_id AND me.id = sh.bride_id
      AND sh.recipient_scope IN ('both', 'bride_only'))
   )
  WHERE a.access_level = 'proposal'
  GROUP BY a.access_level;
$$;

ALTER FUNCTION public.get_proposal_card_disclosure(uuid) OWNER TO postgres;
COMMENT ON FUNCTION public.get_proposal_card_disclosure(uuid) IS
  'למי שצופה בכרטיס דרך הצעת שידוך: מה השדכן שיתף (קו"ח, פרטי ממליצים). אפס שורות למי שאינו צופה דרך הצעה';
REVOKE ALL ON FUNCTION public.get_proposal_card_disclosure(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_proposal_card_disclosure(uuid) TO authenticated;

-- הכרטיס בהצעה: הגוף מ-20261023120000_proposal_medical_contact_private.sql. השינויים:
-- הדגלים נקראים מ-get_proposal_card_disclosure, וטלפון ואימייל של ממליצים לפי הדגל.
CREATE OR REPLACE FUNCTION public.get_proposal_student_card(p_student_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  -- מי רשאי ומה נפתח לו: מקור אחד, get_student_card_access (לפי auth.uid()).
  -- רק מי שרואה את הכרטיס בזכות הצעה ('proposal') מקבל כאן תשובה; בעלים,
  -- שדכן, מנהל ואיש צוות קוראים את הטבלה עצמה, ומי שאין לו גישה מקבל NULL.
  -- מי רשאי: get_student_card_access (רק מי שרואה את הכרטיס בזכות הצעה). מה
  -- נפתח: get_proposal_cv_disclosure (קו"ח) והדגל הרפואי של אותה הכרעה.
  WITH gate AS (
    SELECT d.share_cv,
           d.share_references,
           d.legacy_share_contact,
           a.share_medical,
           -- כרטיס צד שלישי שלא אושר להצגה מלאה: נתונים בסיסיים בלבד
           public.student_display_restricted(p_student_id) AS basic_only
      FROM public.get_student_card_access(p_student_id) a
      JOIN public.get_proposal_card_disclosure(p_student_id) d ON true
     WHERE a.access_level = 'proposal'
  )
  SELECT
    jsonb_build_object(
      'id', s.id,
      'first_name', s.first_name,
      'last_name', s.last_name,
      'nickname', s.nickname,
      'gender', s.gender,
      'personal_status', s.personal_status,
      'birth_date', s.birth_date,
      'height', s.height,
      'country', s.country,
      'city', s.city,
      'community', s.community,
      'shtible', s.shtible,
      'plan_for_life', CASE WHEN g.basic_only THEN NULL ELSE s.plan_for_life END,
      'head_cover_type', CASE WHEN g.basic_only THEN NULL ELSE s.head_cover_type END,
      'about', CASE WHEN g.basic_only THEN NULL ELSE s.about END,
      'in_shidduchim', s.in_shidduchim,
      -- סוג הטלפון הוא העדפה ולא פרט התקשרות: מוצג תמיד למי שקיבל הצעה
      'cellphone_type', s.cellphone_type,
      -- כל הורה בלי טלפון ואימייל, תמיד; בכרטיס בסיסי שמות בלבד
      'parents_info', CASE
        WHEN s.parents_info IS NULL OR jsonb_typeof(s.parents_info) <> 'object' THEN NULL
        WHEN g.basic_only THEN jsonb_build_object(
          'father', jsonb_build_object('self', s.parents_info->'father'->'self'),
          'mother', jsonb_build_object('self', s.parents_info->'mother'->'self')
        )
        ELSE (
          SELECT COALESCE(
                   jsonb_object_agg(
                     e.key,
                     CASE WHEN jsonb_typeof(e.value) = 'object'
                          THEN e.value - 'phone' - 'email'
                          ELSE e.value END
                   ),
                   '{}'::jsonb
                 )
            FROM jsonb_each(s.parents_info) AS e(key, value)
        )
      END,
      'family_info', CASE WHEN g.basic_only THEN NULL ELSE s.family_info END,
      -- פרטי הממלא: בלי ההסבר "מדוע מילאתי" (מנהל וממלא בלבד), ובלי טלפון ואימייל
      'author_info', CASE
        WHEN s.author_info IS NULL OR jsonb_typeof(s.author_info) <> 'object' THEN NULL
        ELSE s.author_info - 'fillReason' - 'phone' - 'email'
      END,
      'card_for', s.card_for,
      'third_party_full_display_approved_at', s.third_party_full_display_approved_at,
      'third_party_proposals_approved_at', s.third_party_proposals_approved_at,
      'education_history', COALESCE((
        SELECT jsonb_agg(
                 jsonb_build_object(
                   'id', eh.id,
                   'student_id', eh.student_id,
                   'institution_type', eh.institution_type,
                   'name', eh.name,
                   'community', eh.community,
                   'city', eh.city
                 ) ORDER BY eh.id
               )
          FROM public.education_history eh
         WHERE eh.student_id = s.id
      ), '[]'::jsonb),
      'employment_history', COALESCE((
        SELECT jsonb_agg(
                 jsonb_build_object(
                   'id', em.id,
                   'student_id', em.student_id,
                   'category', em.category,
                   'role', em.role,
                   'location', em.location,
                   'description', em.description
                 ) ORDER BY em.id
               )
          FROM public.employment_history em
         WHERE em.student_id = s.id
      ), '[]'::jsonb),
      'partner_preferences', CASE WHEN g.basic_only THEN NULL ELSE (
        SELECT jsonb_build_object(
                 'id', pp.id,
                 'student_id', pp.student_id,
                 'age_min', pp.age_min,
                 'age_max', pp.age_max,
                 'preferred_countries', pp.preferred_countries,
                 'work_status', pp.work_status,
                 'head_cover_type', pp.head_cover_type,
                 'plan_for_life', pp.plan_for_life,
                 'cellphone_type', pp.cellphone_type,
                 'about_partner', pp.about_partner,
                 'additional_information', pp.additional_information
               )
          FROM public.partner_preferences pp
         WHERE pp.student_id = s.id
      ) END,
      -- הטלפון של הרב שליווה את הגירושין הוא פרט התקשרות: אינו מוחזר
      'previous_partners', CASE WHEN g.basic_only THEN '[]'::jsonb ELSE COALESCE((
        SELECT jsonb_agg(
                 jsonb_build_object(
                   'id', pr.id,
                   'student_id', pr.student_id,
                   'separation_type', pr.separation_type,
                   'full_name', pr.full_name,
                   'marriage_date', pr.marriage_date,
                   'divorce_date', pr.divorce_date,
                   'death_date', pr.death_date,
                   'children_number', pr.children_number,
                   'divorce_details', CASE
                     WHEN jsonb_typeof(pr.divorce_details) = 'object'
                       THEN pr.divorce_details - 'rabbiPhone'
                     ELSE pr.divorce_details
                   END,
                   'children', pr.children,
                   'no_children', pr.no_children
                 ) ORDER BY pr.id
               )
          FROM public.previous_partners pr
         WHERE pr.student_id = s.id
      ), '[]'::jsonb) END,
      -- ממליצים: שם וסוג תמיד; טלפון ואימייל רק כשהשדכן בחר לשתף את פרטי
      -- הממליצים בהצעה הזו
      'references', CASE WHEN g.basic_only THEN '[]'::jsonb ELSE COALESCE((
        SELECT jsonb_agg(
                 CASE WHEN g.share_references THEN
                   jsonb_build_object(
                     'id', rf.id,
                     'reference_type', rf.reference_type,
                     'name', rf.name,
                     'phone', rf.phone,
                     'email', rf.email
                   )
                 ELSE
                   jsonb_build_object(
                     'id', rf.id,
                     'reference_type', rf.reference_type,
                     'name', rf.name
                   )
                 END ORDER BY rf.id
               )
          FROM public."references" rf
         WHERE rf.student_id = s.id
      ), '[]'::jsonb) END
    )
    -- קובץ הקו"ח: רק כשהשדכן בחר לשתף אותו בהצעה. טלפון, כתובת ופרטי קשר של
    -- המיועד/ת, ההורים והממלא אינם מוחזרים למי שקיבל הצעה - בשום דגל.
    || CASE WHEN g.share_cv THEN jsonb_build_object('cv_url', s.cv_url)
       ELSE '{}'::jsonb END
    -- תאימות לקוד ישן בלבד: בהצעה שנפתחה פעם בדגל הישן הקוד הקודם דורש את
    -- שלושת המפתחות האלה כדי לטעון את הכרטיס. הם חוזרים ריקים תמיד (אין בהם
    -- מידע), ויוסרו יחד עם העמודה share_contact_details.
    || CASE WHEN g.legacy_share_contact THEN
         jsonb_build_object('phone', NULL, 'street', NULL, 'house', NULL)
       ELSE '{}'::jsonb END
    -- הצהרה רפואית: רק כשנפתחה, ולעולם לא בכרטיס בסיסי. בלי contact_info - פרטי
    -- הקשר שבהצהרה (הורים או אנשי קשר אחרים) אינם מגיעים לצד השני.
    || CASE WHEN g.share_medical THEN
         jsonb_build_object(
           'medical_records', CASE WHEN g.basic_only THEN NULL ELSE (
             SELECT jsonb_build_object(
                      'id', mr.id,
                      'student_id', mr.student_id,
                      'status', mr.status,
                      'exposure_level', mr.exposure_level,
                      'details', mr.details,
                      'documents', mr.documents,
                      'related_issue_preference', mr.related_issue_preference
                    )
               FROM public.medical_records mr
              WHERE mr.student_id = s.id
           ) END
         )
       ELSE '{}'::jsonb END
    FROM public.students s
   CROSS JOIN gate g
   WHERE s.id = p_student_id
     AND s.deleted_at IS NULL;
$$;

ALTER FUNCTION public.get_proposal_student_card(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_proposal_student_card(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_proposal_student_card(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ── rollback ─────────────────────────────────────────────────────────
-- בטוח רק כשהקוד שכותב share_references אינו באוויר. הבחירות שנשמרו נמחקות.
--   -- קודם: להריץ שוב את 20261023120000_proposal_medical_contact_private.sql
--   DROP FUNCTION IF EXISTS public.get_proposal_card_disclosure(uuid);
--   ALTER TABLE public.shidduchim DROP COLUMN IF EXISTS share_references;
--   NOTIFY pgrst, 'reload schema';
