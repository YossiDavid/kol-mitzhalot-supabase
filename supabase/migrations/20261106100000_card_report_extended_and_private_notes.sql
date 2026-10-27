-- שני שדות לכל כרטיס, לבקשת הלקוח:
--
-- 1. דיווח מורחב להנהלה: סיבת דיווח חדשה admin_update ("דיווח מורחב להנהלה"),
--    שמחייבת פירוט, ואורך הפירוט עולה ל-4000 תווים (היה 1000) בכל הסיבות.
--    report_student_card מ-20261018120000_card_reports.sql; השינוי מסומן "חדש".
--
-- 2. הערות ותזכורות אישיות לשדכן: student_notes.is_private. הערה אישית גלויה
--    לכותב בלבד - לא לשדכנים האחרים ולא למנהלים. רק הערת שדכן/מנהל יכולה
--    להיות אישית (לא פידבק איש צוות). get_student_shadchan_notes מ-
--    20261031090000_admin_author_label.sql, עם is_private בתוצאה.

-- ── 1. דיווח מורחב ───────────────────────────────────────────────────
ALTER TABLE public.card_reports DROP CONSTRAINT IF EXISTS card_reports_reason_check;
ALTER TABLE public.card_reports ADD CONSTRAINT card_reports_reason_check CHECK (
  reason IN ('wrong_details', 'duplicate_card', 'inappropriate_content',
             'no_longer_available', 'admin_update', 'other')
);
ALTER TABLE public.card_reports DROP CONSTRAINT IF EXISTS card_reports_details_length_check;
ALTER TABLE public.card_reports ADD CONSTRAINT card_reports_details_length_check CHECK (
  details IS NULL OR char_length(details) <= 4000
);
ALTER TABLE public.card_reports DROP CONSTRAINT IF EXISTS card_reports_other_needs_details_check;
ALTER TABLE public.card_reports ADD CONSTRAINT card_reports_other_needs_details_check CHECK (
  reason NOT IN ('other', 'admin_update') OR char_length(btrim(coalesce(details, ''))) > 0
);

CREATE OR REPLACE FUNCTION public.report_student_card(
  p_student_id uuid,
  p_reason text,
  p_details text
) RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_details text := NULLIF(btrim(coalesce(p_details, '')), '');
  v_level text;
  v_owner uuid;
  v_name text;
  v_report_id uuid;
  v_reason_label text;
  c_daily_limit CONSTANT integer := 10;
  c_max_details CONSTANT integer := 4000;  -- חדש (היה 1000)
BEGIN
  IF v_uid IS NULL THEN
    RETURN 'authentication_required';
  END IF;

  IF p_reason IS NULL OR p_reason NOT IN (
    'wrong_details', 'duplicate_card', 'inappropriate_content',
    'no_longer_available', 'admin_update', 'other'  -- חדש: admin_update
  ) THEN
    RETURN 'invalid_reason';
  END IF;
  IF v_details IS NOT NULL AND char_length(v_details) > c_max_details THEN
    RETURN 'details_too_long';
  END IF;
  IF p_reason IN ('other', 'admin_update') AND v_details IS NULL THEN
    RETURN 'details_required';
  END IF;

  -- אותה הכרעת חשיפה כמו בדף הכרטיס: מי שאינו רואה את הכרטיס לא מדווח עליו
  SELECT a.access_level INTO v_level
  FROM public.get_student_card_access(p_student_id) a;
  IF v_level IS NULL OR v_level = 'none' THEN
    RETURN 'card_not_visible';
  END IF;

  SELECT s.user_id, btrim(s.first_name || ' ' || s.last_name)
    INTO v_owner, v_name
  FROM public.students s
  WHERE s.id = p_student_id AND s.deleted_at IS NULL;
  IF v_owner IS NOT DISTINCT FROM v_uid THEN
    RETURN 'own_card';
  END IF;

  IF (SELECT count(*) FROM public.card_reports r
      WHERE r.reporter_id = v_uid
        AND r.created_at > now() - interval '24 hours') >= c_daily_limit THEN
    RETURN 'daily_limit_reached';
  END IF;

  BEGIN
    INSERT INTO public.card_reports (student_id, reporter_id, reason, details)
    VALUES (p_student_id, v_uid, p_reason, v_details)
    RETURNING id INTO v_report_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN 'already_reported';
  END;

  v_reason_label := CASE p_reason
    WHEN 'wrong_details' THEN 'פרטים שגויים'
    WHEN 'duplicate_card' THEN 'כרטיס כפול'
    WHEN 'inappropriate_content' THEN 'תוכן לא הולם'
    WHEN 'no_longer_available' THEN 'המיועד/ת כבר לא בשידוכים'
    WHEN 'admin_update' THEN 'דיווח מורחב להנהלה'
    ELSE 'אחר'
  END;

  INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
  SELECT
    u.id,
    'card_report',
    'דיווח חדש על כרטיס',
    'דווח על הכרטיס של ' || coalesce(v_name, 'מיועד') || ': ' || v_reason_label || '.',
    '/app/admin/card-reports',
    v_report_id
  FROM auth.users u
  WHERE u.raw_app_meta_data->'roles' ? 'admin';

  RETURN 'created';
END;
$function$;

ALTER FUNCTION public.report_student_card(uuid, text, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.report_student_card(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_student_card(uuid, text, text)
  TO authenticated, service_role;

-- ── 2. הערות אישיות ──────────────────────────────────────────────────
ALTER TABLE public.student_notes
  ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;
ALTER TABLE public.student_notes DROP CONSTRAINT IF EXISTS student_notes_private_role_check;
ALTER TABLE public.student_notes ADD CONSTRAINT student_notes_private_role_check CHECK (
  NOT is_private OR author_role IN ('shadchan', 'admin')
);
COMMENT ON COLUMN public.student_notes.is_private IS
  'הערה/תזכורת אישית של השדכן - גלויה לכותב בלבד';

-- הכותב רואה את שלו ב-"Student_notes select own"; כאן רק הערות שאינן אישיות
DROP POLICY IF EXISTS "Student_notes select shadchan notes for shadchanim" ON public.student_notes;
CREATE POLICY "Student_notes select shadchan notes for shadchanim" ON public.student_notes
  FOR SELECT TO authenticated
  USING (
    author_role IN ('shadchan', 'admin')
    AND NOT is_private
    AND public.is_shadchan_or_admin()
  );

DROP FUNCTION IF EXISTS public.get_student_shadchan_notes(uuid);
CREATE FUNCTION public.get_student_shadchan_notes(p_student_id uuid)
RETURNS TABLE (
  id                 uuid,
  body               text,
  created_at         timestamptz,
  updated_at         timestamptz,
  author_id          uuid,
  author_name        text,
  author_gender      text,
  author_has_profile boolean,
  author_is_admin    boolean,
  is_private         boolean
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
    )), ''),
    si.gender,
    public.is_contactable_shadchan(n.author_id),
    COALESCE(public.is_admin(n.author_id), false),
    n.is_private
  FROM public.student_notes n
  JOIN public.students s ON s.id = n.student_id AND s.deleted_at IS NULL
  LEFT JOIN auth.users u ON u.id = n.author_id
  LEFT JOIN public.user_profiles p ON p.id = n.author_id
  LEFT JOIN public.shadchanim_info si ON si.user_id = n.author_id
  WHERE n.student_id = p_student_id
    AND n.author_role IN ('shadchan', 'admin')
    AND public.is_shadchan_or_admin()
    -- חדש: הערה אישית - לכותב בלבד
    AND (NOT n.is_private OR n.author_id = auth.uid())
  ORDER BY n.created_at DESC;
$$;

ALTER FUNCTION public.get_student_shadchan_notes(uuid) OWNER TO postgres;

COMMENT ON FUNCTION public.get_student_shadchan_notes(uuid)
  IS 'הערות שדכן על כרטיס עם שם הכותב, המגדר שלו, האם יש לו עמוד שדכן והאם הוא מנהל. מחזירה שורות רק לשדכן/מנהל מחובר; הערה אישית (is_private) - לכותב בלבד.';

REVOKE ALL ON FUNCTION public.get_student_shadchan_notes(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_student_shadchan_notes(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_student_shadchan_notes(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_shadchan_notes(uuid) TO service_role;


NOTIFY pgrst, 'reload schema';

-- ── rollback ─────────────────────────────────────────────────────────
--   report_student_card ואילוצי card_reports מ-20261018120000_card_reports.sql
--   (אחרי מחיקת/המרת שורות admin_update ופירוט ארוך מ-1000)
--   get_student_shadchan_notes מ-20261031090000_admin_author_label.sql
--   המדיניות מ-20261006110000_shared_notes_and_auto_engagement.sql, ואז
--   להסיר את student_notes_private_role_check ואת העמודה is_private
