-- כרטיס שנצפה דרך הצעת שידוך, שלב 1 מתוך 2 (תוספת בלבד, בטוח להחיל לפני הקוד).
--
-- עד היום מנהל כרטיס (הורה) שקיבל הצעה עבר את מדיניות ה-SELECT של students
-- (shidduch_reveals_student) וראה את כל השורה של הצד השני, ולכן יכול היה
-- לקרוא ישירות דרך PostgREST גם טלפון, כתובת, ת.ז. וקו"ח - מה שהאפליקציה
-- מסתירה רק בבחירת ה-select (student-proposal-card.ts).
--
-- כאן נוספת פונקציה אחת שמחזירה את הכרטיס בדיוק כפי שמותר להציג אותו בהצעה:
-- רשימת עמודות מפורשת (עמודה חדשה אינה נחשפת עד שתתווסף כאן), פרטי התקשרות
-- רק כשהשדכן פתח אותם (share_contact_details), והצהרה רפואית רק כשנפתחה
-- (share_medical_info). הכללים זהים ל-buildProposalStudentSelect +
-- redactProposalStudent + הסרת fillReason (shape-student-card.ts), ובדיקת
-- proposal-card-gate.spec.ts משווה אותם מפתח מול מפתח.
--
-- שלב 2 (20261015100000_proposal_card_lockdown.sql) מסיר את הגישה הישירה, ויש
-- להחיל אותו רק אחרי שהקוד שקורא דרך הפונקציה עלה לאוויר.
-- אידמפוטנטית. להחלה: psql --single-transaction -v ON_ERROR_STOP=1 -f <file>

CREATE OR REPLACE FUNCTION public.get_proposal_student_card(p_student_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  -- מי רשאי ומה נפתח לו: מקור אחד, get_student_card_access (לפי auth.uid()).
  -- רק מי שרואה את הכרטיס בזכות הצעה ('proposal') מקבל כאן תשובה; בעלים,
  -- שדכן, מנהל ואיש צוות קוראים את הטבלה עצמה, ומי שאין לו גישה מקבל NULL.
  WITH gate AS (
    SELECT a.share_contact,
           a.share_medical,
           -- כרטיס צד שלישי שלא אושר להצגה מלאה: נתונים בסיסיים בלבד
           public.student_display_restricted(p_student_id) AS basic_only
      FROM public.get_student_card_access(p_student_id) a
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
      -- כל הורה בלי טלפון ואימייל, אלא אם ההתקשרות נפתחה; בכרטיס בסיסי שמות בלבד
      'parents_info', CASE
        WHEN s.parents_info IS NULL OR jsonb_typeof(s.parents_info) <> 'object' THEN NULL
        WHEN g.basic_only THEN jsonb_build_object(
          'father', jsonb_build_object('self', s.parents_info->'father'->'self'),
          'mother', jsonb_build_object('self', s.parents_info->'mother'->'self')
        )
        WHEN g.share_contact THEN s.parents_info
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
      -- פרטי הממלא: בלי ההסבר "מדוע מילאתי" (מנהל וממלא בלבד), ובלי טלפון
      -- ואימייל כשההתקשרות סגורה
      'author_info', CASE
        WHEN s.author_info IS NULL OR jsonb_typeof(s.author_info) <> 'object' THEN NULL
        WHEN g.share_contact THEN s.author_info - 'fillReason'
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
      -- הטלפון של הרב שליווה את הגירושין נחשב פרט התקשרות
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
                     WHEN g.share_contact THEN pr.divorce_details
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
      -- ממליצים: שם וסוג תמיד; טלפון ואימייל רק כשההתקשרות נפתחה
      'references', CASE WHEN g.basic_only THEN '[]'::jsonb ELSE COALESCE((
        SELECT jsonb_agg(
                 CASE WHEN g.share_contact THEN
                   jsonb_build_object(
                     'id', rf.id,
                     'student_id', rf.student_id,
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
    -- פרטי התקשרות: רק כשהשדכן פתח אותם להצעה. בכרטיס בסיסי נשארים רק סוג
    -- הטלפון והקו"ח (שניהם חלק מהנתונים הבסיסיים), בלי טלפון וכתובת.
    || CASE WHEN g.share_contact THEN
         jsonb_build_object(
           'phone', CASE WHEN g.basic_only THEN NULL ELSE s.phone END,
           'street', CASE WHEN g.basic_only THEN NULL ELSE s.street END,
           'house', CASE WHEN g.basic_only THEN NULL ELSE s.house END,
           'cellphone_type', s.cellphone_type,
           'cv_url', s.cv_url
         )
       ELSE '{}'::jsonb END
    -- הצהרה רפואית: רק כשנפתחה, ולעולם לא בכרטיס בסיסי
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
                      'contact_info', mr.contact_info,
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

COMMENT ON FUNCTION public.get_proposal_student_card(uuid) IS
  'הכרטיס כפי שמותר להציג אותו למי שקיבל הצעת שידוך: עמודות מפורשות, התקשרות והצהרה רפואית רק לפי מה שהשדכן פתח. NULL למי שאינו צופה דרך הצעה';

REVOKE ALL ON FUNCTION public.get_proposal_student_card(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_proposal_student_card(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ── rollback ─────────────────────────────────────────────────────────
-- בטוח רק כשהקוד שקורא לפונקציה אינו באוויר, ואחרי rollback של שלב 2
-- (אחרת מי שקיבל הצעה לא יוכל לפתוח את הכרטיס של הצד השני).
--
--   DROP FUNCTION IF EXISTS public.get_proposal_student_card(uuid);
--   NOTIFY pgrst, 'reload schema';
