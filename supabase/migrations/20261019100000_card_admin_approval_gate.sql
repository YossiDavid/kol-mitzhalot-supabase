-- אישור הנהלה לכל כרטיס חדש, שלב 2 מתוך 2: כרטיס חדש ממתין, וכרטיס שאינו
-- מאושר חבוי.
--
-- להחיל רק אחרי ש-20261019090000_card_admin_approval.sql הוחל והקוד (תור
-- האישור של המנהל, הסטטוס אצל בעל הכרטיס, המיילים) עלה לאוויר. קוד ישן מול
-- המסד הזה: כרטיס חדש ייווצר ממתין ויוסתר, בלי שלמנהל יש איפה לאשר אותו ובלי
-- שבעל הכרטיס רואה הסבר.
--
-- מה משתנה:
--   1. כרטיס חדש נוצר ממתין (מנהל שיוצר כרטיס - מאושר מיד).
--   2. כרטיס שאינו מאושר (ממתין או נדחה) נקרא רק על ידי בעליו ומנהלים: לא
--      מ-students, לא מ-student_cards, לא מהטבלאות המקושרות, ולא דרך הפונקציות
--      שמכריעות גישה (get_student_card_access ומה שנשען עליה: כרטיס בהצעה,
--      דיווח, גלריה), איש צוות, תמונות, פידבק צוות ושרשור צ'אט על הכרטיס.
--   3. אין הצעה חדשה (גם לא טיוטה) ואין שליחה על כרטיס שאינו מאושר.
--   4. מי שאינו בעל הכרטיס או מנהל אינו מעדכן כרטיס שאינו מאושר.
-- כרטיס מאושר (כל הכרטיסים הקיימים), בעלים ומנהלים: בלי שינוי.
-- גופי הפונקציות הועתקו מההגדרה הקיימת במסד; התוספת מסומנת בהערה בכל אחת.
-- אידמפוטנטית. להחלה: psql --single-transaction -v ON_ERROR_STOP=1 -f <file>

-- ── 1. כרטיס חדש ממתין לאישור ────────────────────────────────────────
ALTER TABLE public.students ALTER COLUMN admin_approved_at DROP DEFAULT;

-- הנעילה (enforce_student_admin_approval_lock, שלב 1) מופעלת מעכשיו גם ביצירה:
-- מנהל - מאושר מיד; service role - כפי שנשלח; כל משתמש אחר - ממתין.
DROP TRIGGER IF EXISTS trigger_enforce_student_admin_approval_lock ON public.students;
CREATE TRIGGER trigger_enforce_student_admin_approval_lock
  BEFORE INSERT OR UPDATE OF admin_approved_at, admin_approved_by,
    admin_rejected_at, admin_rejected_by, admin_rejection_reason
  ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.enforce_student_admin_approval_lock();

-- ── 2. עדכון של כרטיס שאינו מאושר: בעליו, מנהל או service role בלבד ────────
-- update_full_student_profile מתירה גם לשדכן לערוך כרטיס; כרטיס שאינו מאושר
-- אינו גלוי לו, ולכן גם אינו נערך על ידו (כולל דרך פונקציות SECURITY DEFINER).
CREATE OR REPLACE FUNCTION public.enforce_unapproved_card_writes() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF OLD.admin_approved_at IS NULL
     AND auth.uid() IS NOT NULL
     AND auth.uid() IS DISTINCT FROM OLD.user_id
     AND NOT COALESCE(public.is_admin(), false) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501',
      HINT = 'הכרטיס ממתין לאישור הנהלת המערכת';
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.enforce_unapproved_card_writes() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.enforce_unapproved_card_writes() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trigger_enforce_unapproved_card_writes ON public.students;
CREATE TRIGGER trigger_enforce_unapproved_card_writes
  BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.enforce_unapproved_card_writes();

-- ── 3. students: מדיניות מגבילה (מצטרפת ב-AND לקיימות, אינה מרחיבה גישה) ───
DROP POLICY IF EXISTS "Unapproved cards are read by owner and admin only" ON public.students;
CREATE POLICY "Unapproved cards are read by owner and admin only" ON public.students
  AS RESTRICTIVE FOR SELECT
  USING (
    admin_approved_at IS NOT NULL
    OR (SELECT auth.uid()) = user_id
    OR public.is_admin()
  );

-- ── 4. student_cards: אותו כלל (ה-view רץ בהרשאות הבעלים וחוזר על הנראות) ──
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
         THEN s.admin_rejection_reason END AS admin_rejection_reason
  FROM public.students s
  CROSS JOIN LATERAL (
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

-- ── 5. הטבלאות המקושרות: שורות של כרטיס שאינו מאושר - לבעליו ולמנהל בלבד ───
DROP POLICY IF EXISTS "Unapproved cards are read by owner and admin only" ON public.education_history;
CREATE POLICY "Unapproved cards are read by owner and admin only" ON public.education_history
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT public.student_hidden_until_approved(student_id));
DROP POLICY IF EXISTS "Unapproved cards are read by owner and admin only" ON public.employment_history;
CREATE POLICY "Unapproved cards are read by owner and admin only" ON public.employment_history
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT public.student_hidden_until_approved(student_id));
DROP POLICY IF EXISTS "Unapproved cards are read by owner and admin only" ON public.previous_partners;
CREATE POLICY "Unapproved cards are read by owner and admin only" ON public.previous_partners
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT public.student_hidden_until_approved(student_id));
DROP POLICY IF EXISTS "Unapproved cards are read by owner and admin only" ON public."references";
CREATE POLICY "Unapproved cards are read by owner and admin only" ON public."references"
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT public.student_hidden_until_approved(student_id));
DROP POLICY IF EXISTS "Unapproved cards are read by owner and admin only" ON public.partner_preferences;
CREATE POLICY "Unapproved cards are read by owner and admin only" ON public.partner_preferences
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT public.student_hidden_until_approved(student_id));
DROP POLICY IF EXISTS "Unapproved cards are read by owner and admin only" ON public.medical_records;
CREATE POLICY "Unapproved cards are read by owner and admin only" ON public.medical_records
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT public.student_hidden_until_approved(student_id));

-- הערות ובקשות צפייה בתמונה אינן נכתבות על כרטיס שאינו גלוי לכותב
DROP POLICY IF EXISTS "No writes about unapproved cards" ON public.student_notes;
CREATE POLICY "No writes about unapproved cards" ON public.student_notes
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT public.student_hidden_until_approved(student_id));
DROP POLICY IF EXISTS "No writes about unapproved cards" ON public.photo_view_requests;
CREATE POLICY "No writes about unapproved cards" ON public.photo_view_requests
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT public.student_hidden_until_approved(student_id));

-- ── 6. הפונקציות שמכריעות גישה או מחזירות נתוני כרטיס ──────────────────
CREATE OR REPLACE FUNCTION public.get_student_card_access(sid uuid)
 RETURNS TABLE(access_level text, share_contact boolean, share_medical boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  WITH target AS (
    SELECT s.id, s.user_id, s.admin_approved_at
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
      -- כרטיס שהנהלת המערכת לא אישרה (ממתין או נדחה): בעליו ומנהל בלבד. קודם
      -- לכל שאר הענפים, ולכן גם שדכן, איש צוות ומי שקיבל הצעה מקבלים 'none'.
      WHEN (SELECT admin_approved_at FROM target) IS NULL
        AND (SELECT user_id FROM target) IS DISTINCT FROM auth.uid()
        AND NOT COALESCE(public.is_admin(), false) THEN 'none'
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
$function$;

CREATE OR REPLACE FUNCTION public.staff_can_access_student(uid uuid, sid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  SELECT public.has_role(uid, 'staff')
    AND EXISTS (
      SELECT 1
      FROM public.students s
      JOIN public.staff_institutions sinst
        ON sinst.institution_id = s.institution_id
      JOIN public.staff_info si
        ON si.user_id = sinst.user_id
      WHERE s.id = sid
        AND s.deleted_at IS NULL
        -- איש צוות אינו רואה כרטיס שהנהלת המערכת לא אישרה
        AND s.admin_approved_at IS NOT NULL
        AND sinst.user_id = uid
        AND si.application_status = 'approved'
    );
$function$;

CREATE OR REPLACE FUNCTION public.can_view_student_photo(uid uuid, sid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.students s
    WHERE s.id = sid
      AND s.deleted_at IS NULL
      -- כרטיס שהנהלת המערכת לא אישרה: בעליו ומנהל בלבד
      AND (
        s.admin_approved_at IS NOT NULL
        OR s.user_id = uid
        OR public.has_role(uid, 'admin')
      )
      AND (
        -- תמונת בן גלויה, אלא אם הצופה הגיע אליו רק דרך הצעה והשדכן לא שיתף
        (s.gender = 'male' AND NOT public.groom_photo_withheld(uid, s.id))
        -- בעל הכרטיס (ההורה שיצר אותו) רואה את התמונה שהוא עצמו העלה
        OR s.user_id = uid
        OR public.has_role(uid, 'admin')
        OR EXISTS (
          SELECT 1
          FROM public.photo_view_requests r
          WHERE r.student_id = s.id
            AND r.requester_id = uid
            AND r.status = 'approved'
        )
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.get_my_shidduch_proposals(p_shidduch_id uuid DEFAULT NULL::uuid, p_open_only boolean DEFAULT false, p_limit integer DEFAULT NULL::integer)
 RETURNS TABLE(shidduch_id uuid, side text, status shidduch_status_enum, shadchan_id uuid, shadchan_first_name text, shadchan_last_name text, note text, sent_at timestamp with time zone, created_at timestamp with time zone, my_student_id uuid, my_first_name text, my_last_name text, other_student_id uuid, other_first_name text, other_last_name text, other_city text, other_birth_date date, my_response text, my_response_message text, my_responded_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  SELECT
    sh.id,
    v.side,
    sh.status,
    sh.shadchan_id,
    up.first_name,
    up.last_name,
    v.note,
    sh.sent_at,
    sh.created_at,
    me.id,
    me.first_name,
    me.last_name,
    other.id,
    other.first_name,
    other.last_name,
    other.city,
    other.birth_date,
    r.response,
    r.message,
    r.updated_at
  FROM public.shidduchim sh
  CROSS JOIN LATERAL (
    VALUES
      ('groom', sh.groom_id, sh.bride_id, sh.note_for_groom),
      ('bride', sh.bride_id, sh.groom_id, sh.note_for_bride)
  ) AS v(side, my_id, other_id, note)
  JOIN public.students me
    ON me.id = v.my_id
   AND me.user_id = auth.uid()
   AND me.deleted_at IS NULL
  LEFT JOIN public.students other
    ON other.id = v.other_id
   AND other.deleted_at IS NULL
   -- כרטיס של הצד השני שאישורו בוטל או שנדחה: הפרטים שלו אינם מוחזרים
   AND other.admin_approved_at IS NOT NULL
  LEFT JOIN public.user_profiles up ON up.id = sh.shadchan_id
  LEFT JOIN public.shidduch_responses r
    ON r.shidduch_id = sh.id
   AND r.side = v.side
  WHERE auth.uid() IS NOT NULL
    AND sh.status <> 'draft'
    AND sh.recipient_scope IN ('both', v.side || '_only')
    AND (p_shidduch_id IS NULL OR sh.id = p_shidduch_id)
    AND (
      NOT p_open_only
      OR sh.status IN ('sent', 'waiting_response', 'interested', 'more_info_needed', 'in_progress')
    )
  ORDER BY COALESCE(sh.sent_at, sh.created_at) DESC, sh.id, v.side
  LIMIT p_limit;
$function$;

CREATE OR REPLACE FUNCTION public.get_or_create_context_room(other_user_id uuid, p_context_kind text DEFAULT 'general'::text, p_student_id uuid DEFAULT NULL::uuid, p_shidduch_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  me      uuid := auth.uid();
  v_label text := NULL;
  v_owner uuid;
  v_approved_at timestamptz;
  v_sh    public.shidduchim%ROWTYPE;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF other_user_id IS NULL OR other_user_id = me THEN
    RAISE EXCEPTION 'invalid_other_user';
  END IF;
  IF p_context_kind IS NULL OR p_context_kind NOT IN ('general', 'student', 'shidduch') THEN
    RAISE EXCEPTION 'invalid_context';
  END IF;

  IF p_context_kind = 'general' THEN
    -- התנהגות קיימת: שיחה כללית פתוחה לכל זוג. יעד שנשלח עם general נפסל,
    -- כדי שקריאה שגויה לא תיבלע בשקט כשיחה כללית.
    IF p_student_id IS NOT NULL OR p_shidduch_id IS NOT NULL THEN
      RAISE EXCEPTION 'invalid_context';
    END IF;

  ELSIF p_context_kind = 'student' THEN
    -- פנייה על כרטיס: בין בעל הכרטיס לשדכן/מנהל, לכל כיוון. השדכן/מנהל רשאי
    -- לראות כל כרטיס (מדיניות students), ולכן זה התנאי ל"מותר לצפות בכרטיס".
    IF p_student_id IS NULL OR p_shidduch_id IS NOT NULL THEN
      RAISE EXCEPTION 'invalid_context';
    END IF;

    SELECT s.user_id,
           NULLIF(BTRIM(COALESCE(s.first_name, '') || ' ' || COALESCE(s.last_name, '')), ''),
           s.admin_approved_at
    INTO v_owner, v_label, v_approved_at
    FROM public.students s
    WHERE s.id = p_student_id AND s.deleted_at IS NULL;

    IF NOT FOUND OR v_owner IS NULL THEN
      RAISE EXCEPTION 'invalid_context';
    END IF;

    -- COALESCE: תוצאה NULL (למשל is_admin על משתמש שאינו קיים) חייבת להיחשב דחייה
    IF NOT COALESCE(
      (v_owner = me AND public.is_contactable_shadchan(other_user_id))
      OR (v_owner = other_user_id AND public.is_contactable_shadchan(me)),
      false
    ) THEN
      RAISE EXCEPTION 'context_not_allowed';
    END IF;

    -- כרטיס שהנהלת המערכת לא אישרה: שרשור עליו נפתח רק בין בעליו למנהל
    IF v_approved_at IS NULL AND NOT COALESCE(
      public.is_admin(CASE WHEN v_owner = me THEN other_user_id ELSE me END),
      false
    ) THEN
      RAISE EXCEPTION 'context_not_allowed';
    END IF;

    v_label := COALESCE(v_label, 'כרטיס');

  ELSE
    -- שרשור הצעה: השדכן של ההצעה (או מנהל) מול בעל כרטיס של צד שההצעה
    -- נשלחה אליו. שני בעלי הצדדים לעולם אינם מדברים כאן זה עם זה, כי אף אחד
    -- מהם אינו השדכן. טיוטה (או recipient_scope ריק) - ההצעה לא נשלחה.
    IF p_shidduch_id IS NULL OR p_student_id IS NOT NULL THEN
      RAISE EXCEPTION 'invalid_context';
    END IF;

    SELECT * INTO v_sh FROM public.shidduchim WHERE id = p_shidduch_id;
    IF NOT FOUND OR v_sh.status = 'draft' OR v_sh.recipient_scope IS NULL THEN
      RAISE EXCEPTION 'invalid_context';
    END IF;

    -- שדכן ההצעה חייב להיות שדכן/מנהל כרגע (תפקיד שנשלל = אין שרשור חדש)
    IF NOT COALESCE(
      (((me = v_sh.shadchan_id AND public.is_contactable_shadchan(me)) OR public.is_admin(me))
         AND public.chat_user_owns_recipient_side(p_shidduch_id, other_user_id))
      OR (((other_user_id = v_sh.shadchan_id AND public.is_contactable_shadchan(other_user_id))
           OR public.is_admin(other_user_id))
         AND public.chat_user_owns_recipient_side(p_shidduch_id, me)),
      false
    ) THEN
      RAISE EXCEPTION 'context_not_allowed';
    END IF;

    v_label := public.chat_shidduch_label(p_shidduch_id);
  END IF;

  RETURN public.chat_find_or_create_room(me, other_user_id, p_context_kind, p_student_id, p_shidduch_id, v_label);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_student_staff_feedback(p_student_id uuid)
 RETURNS TABLE(id uuid, body text, created_at timestamp with time zone, author_name text, institution_name text, institution_city text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
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
    -- כרטיס שהנהלת המערכת לא אישרה: בעליו ומנהל בלבד
    AND NOT public.student_hidden_until_approved(s.id)
  JOIN auth.users u ON u.id = n.author_id
  LEFT JOIN public.user_profiles p ON p.id = n.author_id
  LEFT JOIN public.institutions i ON i.id = n.author_institution_id
  WHERE n.student_id = p_student_id
    AND n.author_role = 'staff'
  ORDER BY n.created_at DESC;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_shidduch_card_gates()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sides    text[];
  v_side     text;
  v_student  uuid;
  v_quota    record;
  v_pending  integer;
  v_uid      uuid := auth.uid();
  v_blocked  boolean;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status::text <> 'draft' THEN
    IF NEW.groom_id IS DISTINCT FROM OLD.groom_id
       OR NEW.bride_id IS DISTINCT FROM OLD.bride_id THEN
      RAISE EXCEPTION 'shidduch_cards_immutable' USING ERRCODE = 'P0001',
        HINT = 'לא ניתן להחליף כרטיס בהצעה שכבר אינה טיוטה';
    END IF;
    IF NEW.shadchan_id IS DISTINCT FROM OLD.shadchan_id
       AND v_uid IS NOT NULL AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'shidduch_shadchan_immutable' USING ERRCODE = 'P0001',
        HINT = 'לא ניתן להחליף שדכן בהצעה שכבר אינה טיוטה';
    END IF;
  END IF;

  -- כרטיס שהנהלת המערכת לא אישרה (ממתין או נדחה): אין הצעה חדשה עליו, גם לא
  -- טיוטה. הבדיקה כאן, לפני היציאה המוקדמת של טיוטות.
  IF TG_OP = 'INSERT' THEN
    SELECT s.admin_approved_at IS NULL
      INTO v_blocked FROM public.students s WHERE s.id = NEW.groom_id;
    IF COALESCE(v_blocked, false) THEN
      RAISE EXCEPTION 'card_pending_approval' USING ERRCODE = 'P0001', DETAIL = 'groom';
    END IF;
    SELECT s.admin_approved_at IS NULL
      INTO v_blocked FROM public.students s WHERE s.id = NEW.bride_id;
    IF COALESCE(v_blocked, false) THEN
      RAISE EXCEPTION 'card_pending_approval' USING ERRCODE = 'P0001', DETAIL = 'bride';
    END IF;
  END IF;

  IF NEW.recipient_scope IS NULL OR NEW.status::text IN ('draft', 'rejected') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_sides := public.shidduch_gate_sides(NULL, NULL, NEW.status::text, NEW.recipient_scope);
  ELSE
    -- הורה שחוזר בו מדחייה (respond_to_shidduch): לא "קבלת הצעה" חדשה
    IF OLD.status::text = 'rejected'
       AND NEW.recipient_scope IS NOT DISTINCT FROM OLD.recipient_scope
       AND NEW.sent_at IS NOT DISTINCT FROM OLD.sent_at
       AND v_uid IS NOT NULL
       AND v_uid IS DISTINCT FROM NEW.shadchan_id
       AND NOT public.is_admin() THEN
      RETURN NEW;
    END IF;
    v_sides := public.shidduch_gate_sides(OLD.status::text, OLD.recipient_scope, NEW.status::text, NEW.recipient_scope);
  END IF;

  -- שליחה חדשה לפחות לצד אחד: אם אחד משני הכרטיסים הוא צד שלישי שלא אושר
  -- לקבלת הצעות, כל השליחה נדחית. הצעות קיימות (בלי שליחה חדשה) לא נפגעות.
  IF cardinality(v_sides) > 0 THEN
    -- וגם שליחה של הצעה קיימת (טיוטה ישנה, או כרטיס שאישורו בוטל בינתיים)
    SELECT s.admin_approved_at IS NULL
      INTO v_blocked FROM public.students s WHERE s.id = NEW.groom_id;
    IF COALESCE(v_blocked, false) THEN
      RAISE EXCEPTION 'card_pending_approval' USING ERRCODE = 'P0001', DETAIL = 'groom';
    END IF;
    SELECT s.admin_approved_at IS NULL
      INTO v_blocked FROM public.students s WHERE s.id = NEW.bride_id;
    IF COALESCE(v_blocked, false) THEN
      RAISE EXCEPTION 'card_pending_approval' USING ERRCODE = 'P0001', DETAIL = 'bride';
    END IF;
    SELECT s.card_for = 'other' AND s.third_party_proposals_approved_at IS NULL
      INTO v_blocked FROM public.students s WHERE s.id = NEW.groom_id;
    IF COALESCE(v_blocked, false) THEN
      RAISE EXCEPTION 'card_third_party' USING ERRCODE = 'P0001', DETAIL = 'groom';
    END IF;
    SELECT s.card_for = 'other' AND s.third_party_proposals_approved_at IS NULL
      INTO v_blocked FROM public.students s WHERE s.id = NEW.bride_id;
    IF COALESCE(v_blocked, false) THEN
      RAISE EXCEPTION 'card_third_party' USING ERRCODE = 'P0001', DETAIL = 'bride';
    END IF;
  END IF;

  FOREACH v_side IN ARRAY v_sides LOOP
    v_student := CASE v_side WHEN 'groom' THEN NEW.groom_id ELSE NEW.bride_id END;

    -- נעילה לכל כרטיס עד סוף הטרנזקציה: שתי שליחות מקבילות לאותו כרטיס
    -- נבדקות בזו אחר זו ולא שתיהן מול אותה ספירה (הצדדים ממוינים, ללא deadlock)
    PERFORM pg_advisory_xact_lock(hashtext('shidduch_card_gate'), hashtext(v_student::text));

    SELECT * INTO v_quota FROM public.student_proposal_quota(v_student);
    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    IF v_quota.is_paused THEN
      RAISE EXCEPTION 'card_paused' USING ERRCODE = 'P0001', DETAIL = v_side;
    END IF;

    IF v_quota.limit_count IS NOT NULL THEN
      -- שליחות בשלב הראשון (sent_at ריק, עוד לא ביומן) תופסות מקום: אחרת שתי
      -- שליחות מקבילות בשני שלבים היו עוברות שתיהן את אותה ספירת יומן
      SELECT count(*)::integer INTO v_pending
        FROM public.shidduchim sh
       WHERE sh.id <> NEW.id
         AND sh.sent_at IS NULL
         AND sh.status::text NOT IN ('draft', 'rejected')
         AND v_side = ANY (public.shidduch_scope_sides(sh.recipient_scope))
         AND CASE v_side WHEN 'groom' THEN sh.groom_id ELSE sh.bride_id END = v_student
         AND NOT EXISTS (
           SELECT 1 FROM public.shidduch_events e
            WHERE e.shidduch_id = sh.id AND e.student_id = v_student
         );

      IF v_quota.used_count + v_pending >= v_quota.limit_count THEN
        RAISE EXCEPTION 'proposal_limit_reached' USING ERRCODE = 'P0001', DETAIL = v_side;
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

NOTIFY pgrst, 'reload schema';

-- ── rollback ─────────────────────────────────────────────────────────
-- מחזיר את הנראות ואת "כרטיס חדש נוצר מאושר". כרטיסים שנוצרו ממתינים בינתיים
-- נשארים ממתינים בעמודות (ואינם מוסתרים עוד); לאשר אותם לפי הצורך:
--   UPDATE public.students SET admin_approved_at = now()
--    WHERE admin_approved_at IS NULL AND admin_rejected_at IS NULL;
--
--   ALTER TABLE public.students ALTER COLUMN admin_approved_at SET DEFAULT now();
--   DROP TRIGGER IF EXISTS trigger_enforce_student_admin_approval_lock ON public.students;
--   CREATE TRIGGER trigger_enforce_student_admin_approval_lock
--     BEFORE UPDATE OF admin_approved_at, admin_approved_by,
--       admin_rejected_at, admin_rejected_by, admin_rejection_reason
--     ON public.students
--     FOR EACH ROW EXECUTE FUNCTION public.enforce_student_admin_approval_lock();
--   DROP TRIGGER IF EXISTS trigger_enforce_unapproved_card_writes ON public.students;
--   DROP FUNCTION IF EXISTS public.enforce_unapproved_card_writes();
--   DROP POLICY IF EXISTS "Unapproved cards are read by owner and admin only" ON public.students;
--   DROP POLICY IF EXISTS "Unapproved cards are read by owner and admin only" ON public.education_history;
--   DROP POLICY IF EXISTS "Unapproved cards are read by owner and admin only" ON public.employment_history;
--   DROP POLICY IF EXISTS "Unapproved cards are read by owner and admin only" ON public.previous_partners;
--   DROP POLICY IF EXISTS "Unapproved cards are read by owner and admin only" ON public."references";
--   DROP POLICY IF EXISTS "Unapproved cards are read by owner and admin only" ON public.partner_preferences;
--   DROP POLICY IF EXISTS "Unapproved cards are read by owner and admin only" ON public.medical_records;
--   DROP POLICY IF EXISTS "No writes about unapproved cards" ON public.student_notes;
--   DROP POLICY IF EXISTS "No writes about unapproved cards" ON public.photo_view_requests;
--   -- ה-view: להריץ שוב את החלק של student_cards מתוך 20261019090000_card_admin_approval.sql
--   -- הפונקציות, כפי שהיו לפני המיגרציה הזו:
--
--   CREATE OR REPLACE FUNCTION public.get_student_card_access(sid uuid)
--    RETURNS TABLE(access_level text, share_contact boolean, share_medical boolean)
--    LANGUAGE sql
--    STABLE SECURITY DEFINER
--    SET search_path TO 'public', 'auth'
--   AS $function$
--     WITH target AS (
--       SELECT s.id, s.user_id
--       FROM public.students s
--       WHERE s.id = sid AND s.deleted_at IS NULL
--     ),
--     proposal AS (
--       -- bool_or על פני כל ההצעות הרלוונטיות: להורה עם שני ילדים יכולות
--       -- להיות שתי הצעות על אותו כרטיס, והדגל הפתוח יותר גובר.
--       -- שמות שונים משמות עמודות ה-RETURNS TABLE בכוונה: הפניה לא מוסמכת
--       -- לשם זהה הייתה עלולה להיקרא כעמודת פלט ולא כעמודת ה-CTE.
--       SELECT
--         bool_or(true)                      AS p_has_access,
--         bool_or(sh.share_contact_details)  AS p_share_contact,
--         bool_or(sh.share_medical_info)     AS p_share_medical
--       FROM public.shidduchim sh
--       JOIN public.students me
--         ON me.user_id = auth.uid()
--        AND me.deleted_at IS NULL
--       WHERE sh.status <> 'draft'
--         AND (
--           (sh.bride_id = sid AND me.id = sh.groom_id
--            AND sh.recipient_scope IN ('both', 'groom_only'))
--           OR
--           (sh.groom_id = sid AND me.id = sh.bride_id
--            AND sh.recipient_scope IN ('both', 'bride_only'))
--         )
--     )
--     SELECT
--       CASE
--         WHEN auth.uid() IS NULL THEN 'none'
--         WHEN NOT EXISTS (SELECT 1 FROM target) THEN 'none'
--         -- בעל הכרטיס, שדכן/מנהל ואיש צוות של המוסד רואים הכול ממילא,
--         -- וקדימותם כאן מונעת הצרה מקרית של כרטיס שהם מורשים לו במלואו.
--         WHEN (SELECT user_id FROM target) = auth.uid()
--           OR public.is_shadchan_or_admin()
--           OR public.staff_can_access_student(auth.uid(), sid) THEN 'full'
--         WHEN COALESCE((SELECT p_has_access FROM proposal), false) THEN 'proposal'
--         ELSE 'none'
--       END,
--       COALESCE((SELECT p_share_contact FROM proposal), false),
--       COALESCE((SELECT p_share_medical FROM proposal), false);
--   $function$;
--
--   CREATE OR REPLACE FUNCTION public.staff_can_access_student(uid uuid, sid uuid)
--    RETURNS boolean
--    LANGUAGE sql
--    STABLE SECURITY DEFINER
--    SET search_path TO 'public', 'auth'
--   AS $function$
--     SELECT public.has_role(uid, 'staff')
--       AND EXISTS (
--         SELECT 1
--         FROM public.students s
--         JOIN public.staff_institutions sinst
--           ON sinst.institution_id = s.institution_id
--         JOIN public.staff_info si
--           ON si.user_id = sinst.user_id
--         WHERE s.id = sid
--           AND s.deleted_at IS NULL
--           AND sinst.user_id = uid
--           AND si.application_status = 'approved'
--       );
--   $function$;
--
--   CREATE OR REPLACE FUNCTION public.can_view_student_photo(uid uuid, sid uuid)
--    RETURNS boolean
--    LANGUAGE sql
--    STABLE SECURITY DEFINER
--    SET search_path TO 'public', 'auth'
--   AS $function$
--     SELECT EXISTS (
--       SELECT 1
--       FROM public.students s
--       WHERE s.id = sid
--         AND s.deleted_at IS NULL
--         AND (
--           -- תמונת בן גלויה, אלא אם הצופה הגיע אליו רק דרך הצעה והשדכן לא שיתף
--           (s.gender = 'male' AND NOT public.groom_photo_withheld(uid, s.id))
--           -- בעל הכרטיס (ההורה שיצר אותו) רואה את התמונה שהוא עצמו העלה
--           OR s.user_id = uid
--           OR public.has_role(uid, 'admin')
--           OR EXISTS (
--             SELECT 1
--             FROM public.photo_view_requests r
--             WHERE r.student_id = s.id
--               AND r.requester_id = uid
--               AND r.status = 'approved'
--           )
--         )
--     );
--   $function$;
--
--   CREATE OR REPLACE FUNCTION public.get_my_shidduch_proposals(p_shidduch_id uuid DEFAULT NULL::uuid, p_open_only boolean DEFAULT false, p_limit integer DEFAULT NULL::integer)
--    RETURNS TABLE(shidduch_id uuid, side text, status shidduch_status_enum, shadchan_id uuid, shadchan_first_name text, shadchan_last_name text, note text, sent_at timestamp with time zone, created_at timestamp with time zone, my_student_id uuid, my_first_name text, my_last_name text, other_student_id uuid, other_first_name text, other_last_name text, other_city text, other_birth_date date, my_response text, my_response_message text, my_responded_at timestamp with time zone)
--    LANGUAGE sql
--    STABLE SECURITY DEFINER
--    SET search_path TO 'public', 'auth'
--   AS $function$
--     SELECT
--       sh.id,
--       v.side,
--       sh.status,
--       sh.shadchan_id,
--       up.first_name,
--       up.last_name,
--       v.note,
--       sh.sent_at,
--       sh.created_at,
--       me.id,
--       me.first_name,
--       me.last_name,
--       other.id,
--       other.first_name,
--       other.last_name,
--       other.city,
--       other.birth_date,
--       r.response,
--       r.message,
--       r.updated_at
--     FROM public.shidduchim sh
--     CROSS JOIN LATERAL (
--       VALUES
--         ('groom', sh.groom_id, sh.bride_id, sh.note_for_groom),
--         ('bride', sh.bride_id, sh.groom_id, sh.note_for_bride)
--     ) AS v(side, my_id, other_id, note)
--     JOIN public.students me
--       ON me.id = v.my_id
--      AND me.user_id = auth.uid()
--      AND me.deleted_at IS NULL
--     LEFT JOIN public.students other
--       ON other.id = v.other_id
--      AND other.deleted_at IS NULL
--     LEFT JOIN public.user_profiles up ON up.id = sh.shadchan_id
--     LEFT JOIN public.shidduch_responses r
--       ON r.shidduch_id = sh.id
--      AND r.side = v.side
--     WHERE auth.uid() IS NOT NULL
--       AND sh.status <> 'draft'
--       AND sh.recipient_scope IN ('both', v.side || '_only')
--       AND (p_shidduch_id IS NULL OR sh.id = p_shidduch_id)
--       AND (
--         NOT p_open_only
--         OR sh.status IN ('sent', 'waiting_response', 'interested', 'more_info_needed', 'in_progress')
--       )
--     ORDER BY COALESCE(sh.sent_at, sh.created_at) DESC, sh.id, v.side
--     LIMIT p_limit;
--   $function$;
--
--   CREATE OR REPLACE FUNCTION public.get_or_create_context_room(other_user_id uuid, p_context_kind text DEFAULT 'general'::text, p_student_id uuid DEFAULT NULL::uuid, p_shidduch_id uuid DEFAULT NULL::uuid)
--    RETURNS uuid
--    LANGUAGE plpgsql
--    SECURITY DEFINER
--    SET search_path TO 'public', 'auth'
--   AS $function$
--   DECLARE
--     me      uuid := auth.uid();
--     v_label text := NULL;
--     v_owner uuid;
--     v_sh    public.shidduchim%ROWTYPE;
--   BEGIN
--     IF me IS NULL THEN
--       RAISE EXCEPTION 'not_authenticated';
--     END IF;
--     IF other_user_id IS NULL OR other_user_id = me THEN
--       RAISE EXCEPTION 'invalid_other_user';
--     END IF;
--     IF p_context_kind IS NULL OR p_context_kind NOT IN ('general', 'student', 'shidduch') THEN
--       RAISE EXCEPTION 'invalid_context';
--     END IF;
--
--     IF p_context_kind = 'general' THEN
--       -- התנהגות קיימת: שיחה כללית פתוחה לכל זוג. יעד שנשלח עם general נפסל,
--       -- כדי שקריאה שגויה לא תיבלע בשקט כשיחה כללית.
--       IF p_student_id IS NOT NULL OR p_shidduch_id IS NOT NULL THEN
--         RAISE EXCEPTION 'invalid_context';
--       END IF;
--
--     ELSIF p_context_kind = 'student' THEN
--       -- פנייה על כרטיס: בין בעל הכרטיס לשדכן/מנהל, לכל כיוון. השדכן/מנהל רשאי
--       -- לראות כל כרטיס (מדיניות students), ולכן זה התנאי ל"מותר לצפות בכרטיס".
--       IF p_student_id IS NULL OR p_shidduch_id IS NOT NULL THEN
--         RAISE EXCEPTION 'invalid_context';
--       END IF;
--
--       SELECT s.user_id,
--              NULLIF(BTRIM(COALESCE(s.first_name, '') || ' ' || COALESCE(s.last_name, '')), '')
--       INTO v_owner, v_label
--       FROM public.students s
--       WHERE s.id = p_student_id AND s.deleted_at IS NULL;
--
--       IF NOT FOUND OR v_owner IS NULL THEN
--         RAISE EXCEPTION 'invalid_context';
--       END IF;
--
--       -- COALESCE: תוצאה NULL (למשל is_admin על משתמש שאינו קיים) חייבת להיחשב דחייה
--       IF NOT COALESCE(
--         (v_owner = me AND public.is_contactable_shadchan(other_user_id))
--         OR (v_owner = other_user_id AND public.is_contactable_shadchan(me)),
--         false
--       ) THEN
--         RAISE EXCEPTION 'context_not_allowed';
--       END IF;
--
--       v_label := COALESCE(v_label, 'כרטיס');
--
--     ELSE
--       -- שרשור הצעה: השדכן של ההצעה (או מנהל) מול בעל כרטיס של צד שההצעה
--       -- נשלחה אליו. שני בעלי הצדדים לעולם אינם מדברים כאן זה עם זה, כי אף אחד
--       -- מהם אינו השדכן. טיוטה (או recipient_scope ריק) - ההצעה לא נשלחה.
--       IF p_shidduch_id IS NULL OR p_student_id IS NOT NULL THEN
--         RAISE EXCEPTION 'invalid_context';
--       END IF;
--
--       SELECT * INTO v_sh FROM public.shidduchim WHERE id = p_shidduch_id;
--       IF NOT FOUND OR v_sh.status = 'draft' OR v_sh.recipient_scope IS NULL THEN
--         RAISE EXCEPTION 'invalid_context';
--       END IF;
--
--       -- שדכן ההצעה חייב להיות שדכן/מנהל כרגע (תפקיד שנשלל = אין שרשור חדש)
--       IF NOT COALESCE(
--         (((me = v_sh.shadchan_id AND public.is_contactable_shadchan(me)) OR public.is_admin(me))
--            AND public.chat_user_owns_recipient_side(p_shidduch_id, other_user_id))
--         OR (((other_user_id = v_sh.shadchan_id AND public.is_contactable_shadchan(other_user_id))
--              OR public.is_admin(other_user_id))
--            AND public.chat_user_owns_recipient_side(p_shidduch_id, me)),
--         false
--       ) THEN
--         RAISE EXCEPTION 'context_not_allowed';
--       END IF;
--
--       v_label := public.chat_shidduch_label(p_shidduch_id);
--     END IF;
--
--     RETURN public.chat_find_or_create_room(me, other_user_id, p_context_kind, p_student_id, p_shidduch_id, v_label);
--   END;
--   $function$;
--
--   CREATE OR REPLACE FUNCTION public.get_student_staff_feedback(p_student_id uuid)
--    RETURNS TABLE(id uuid, body text, created_at timestamp with time zone, author_name text, institution_name text, institution_city text)
--    LANGUAGE sql
--    STABLE SECURITY DEFINER
--    SET search_path TO 'public', 'auth'
--   AS $function$
--     SELECT
--       n.id,
--       n.body,
--       n.created_at,
--       NULLIF(BTRIM(CONCAT_WS(' ',
--         COALESCE(NULLIF(BTRIM(p.first_name), ''), NULLIF(BTRIM(u.raw_user_meta_data->>'firstName'), '')),
--         COALESCE(NULLIF(BTRIM(p.last_name), ''),  NULLIF(BTRIM(u.raw_user_meta_data->>'lastName'), ''))
--       )), ''),
--       i.name,
--       i.city
--     FROM public.student_notes n
--     JOIN public.students s ON s.id = n.student_id AND s.deleted_at IS NULL
--     JOIN auth.users u ON u.id = n.author_id
--     LEFT JOIN public.user_profiles p ON p.id = n.author_id
--     LEFT JOIN public.institutions i ON i.id = n.author_institution_id
--     WHERE n.student_id = p_student_id
--       AND n.author_role = 'staff'
--     ORDER BY n.created_at DESC;
--   $function$;
--
--   CREATE OR REPLACE FUNCTION public.enforce_shidduch_card_gates()
--    RETURNS trigger
--    LANGUAGE plpgsql
--    SECURITY DEFINER
--    SET search_path TO 'public'
--   AS $function$
--   DECLARE
--     v_sides    text[];
--     v_side     text;
--     v_student  uuid;
--     v_quota    record;
--     v_pending  integer;
--     v_uid      uuid := auth.uid();
--     v_blocked  boolean;
--   BEGIN
--     IF TG_OP = 'UPDATE' AND OLD.status::text <> 'draft' THEN
--       IF NEW.groom_id IS DISTINCT FROM OLD.groom_id
--          OR NEW.bride_id IS DISTINCT FROM OLD.bride_id THEN
--         RAISE EXCEPTION 'shidduch_cards_immutable' USING ERRCODE = 'P0001',
--           HINT = 'לא ניתן להחליף כרטיס בהצעה שכבר אינה טיוטה';
--       END IF;
--       IF NEW.shadchan_id IS DISTINCT FROM OLD.shadchan_id
--          AND v_uid IS NOT NULL AND NOT public.is_admin() THEN
--         RAISE EXCEPTION 'shidduch_shadchan_immutable' USING ERRCODE = 'P0001',
--           HINT = 'לא ניתן להחליף שדכן בהצעה שכבר אינה טיוטה';
--       END IF;
--     END IF;
--
--     IF NEW.recipient_scope IS NULL OR NEW.status::text IN ('draft', 'rejected') THEN
--       RETURN NEW;
--     END IF;
--
--     IF TG_OP = 'INSERT' THEN
--       v_sides := public.shidduch_gate_sides(NULL, NULL, NEW.status::text, NEW.recipient_scope);
--     ELSE
--       -- הורה שחוזר בו מדחייה (respond_to_shidduch): לא "קבלת הצעה" חדשה
--       IF OLD.status::text = 'rejected'
--          AND NEW.recipient_scope IS NOT DISTINCT FROM OLD.recipient_scope
--          AND NEW.sent_at IS NOT DISTINCT FROM OLD.sent_at
--          AND v_uid IS NOT NULL
--          AND v_uid IS DISTINCT FROM NEW.shadchan_id
--          AND NOT public.is_admin() THEN
--         RETURN NEW;
--       END IF;
--       v_sides := public.shidduch_gate_sides(OLD.status::text, OLD.recipient_scope, NEW.status::text, NEW.recipient_scope);
--     END IF;
--
--     -- שליחה חדשה לפחות לצד אחד: אם אחד משני הכרטיסים הוא צד שלישי שלא אושר
--     -- לקבלת הצעות, כל השליחה נדחית. הצעות קיימות (בלי שליחה חדשה) לא נפגעות.
--     IF cardinality(v_sides) > 0 THEN
--       SELECT s.card_for = 'other' AND s.third_party_proposals_approved_at IS NULL
--         INTO v_blocked FROM public.students s WHERE s.id = NEW.groom_id;
--       IF COALESCE(v_blocked, false) THEN
--         RAISE EXCEPTION 'card_third_party' USING ERRCODE = 'P0001', DETAIL = 'groom';
--       END IF;
--       SELECT s.card_for = 'other' AND s.third_party_proposals_approved_at IS NULL
--         INTO v_blocked FROM public.students s WHERE s.id = NEW.bride_id;
--       IF COALESCE(v_blocked, false) THEN
--         RAISE EXCEPTION 'card_third_party' USING ERRCODE = 'P0001', DETAIL = 'bride';
--       END IF;
--     END IF;
--
--     FOREACH v_side IN ARRAY v_sides LOOP
--       v_student := CASE v_side WHEN 'groom' THEN NEW.groom_id ELSE NEW.bride_id END;
--
--       -- נעילה לכל כרטיס עד סוף הטרנזקציה: שתי שליחות מקבילות לאותו כרטיס
--       -- נבדקות בזו אחר זו ולא שתיהן מול אותה ספירה (הצדדים ממוינים, ללא deadlock)
--       PERFORM pg_advisory_xact_lock(hashtext('shidduch_card_gate'), hashtext(v_student::text));
--
--       SELECT * INTO v_quota FROM public.student_proposal_quota(v_student);
--       IF NOT FOUND THEN
--         CONTINUE;
--       END IF;
--
--       IF v_quota.is_paused THEN
--         RAISE EXCEPTION 'card_paused' USING ERRCODE = 'P0001', DETAIL = v_side;
--       END IF;
--
--       IF v_quota.limit_count IS NOT NULL THEN
--         -- שליחות בשלב הראשון (sent_at ריק, עוד לא ביומן) תופסות מקום: אחרת שתי
--         -- שליחות מקבילות בשני שלבים היו עוברות שתיהן את אותה ספירת יומן
--         SELECT count(*)::integer INTO v_pending
--           FROM public.shidduchim sh
--          WHERE sh.id <> NEW.id
--            AND sh.sent_at IS NULL
--            AND sh.status::text NOT IN ('draft', 'rejected')
--            AND v_side = ANY (public.shidduch_scope_sides(sh.recipient_scope))
--            AND CASE v_side WHEN 'groom' THEN sh.groom_id ELSE sh.bride_id END = v_student
--            AND NOT EXISTS (
--              SELECT 1 FROM public.shidduch_events e
--               WHERE e.shidduch_id = sh.id AND e.student_id = v_student
--            );
--
--         IF v_quota.used_count + v_pending >= v_quota.limit_count THEN
--           RAISE EXCEPTION 'proposal_limit_reached' USING ERRCODE = 'P0001', DETAIL = v_side;
--         END IF;
--       END IF;
--     END LOOP;
--
--     RETURN NEW;
--   END;
--   $function$;
--
--   NOTIFY pgrst, 'reload schema';
