-- כמה הצעות הוצעו לכרטיס (תוספת בלבד, בטוח להחיל לפני הקוד).
--
-- "הצעה שהוצעה לכרטיס" - אותה הגדרה כמו בדוח ההצעות של המנהל ובמכסת ההצעות:
-- שורה ב-shidduch_events (kind = offer_sent) שהכרטיס הוא הצד שקיבל אותה
-- (student_id). טיוטה אינה נספרת; הצעה שנשלחה לצד אחד בלבד נספרת רק לכרטיס של
-- אותו צד; שליחה חוזרת אחרי דחייה נספרת שוב (כמו בדוח).
-- shidduch_events קריאה למנהל בלבד, ולכן:
--   get_card_proposal_count - מספר בלבד, לבעל הכרטיס, לשדכן ולמנהל (לא לאיש
--     צוות, לא למי שצופה דרך הצעה, לא לגולש). כרטיס שאינו מאושר, או כרטיס צד
--     שלישי שהצופה רואה בו נתונים בסיסיים בלבד - NULL.
--   get_my_card_proposals - ההצעות שהשדכן המחובר עצמו הציע לכרטיס.
-- אידמפוטנטית. להחלה: psql --single-transaction -v ON_ERROR_STOP=1 -f <file>

CREATE OR REPLACE FUNCTION public.can_see_card_proposals(p_student_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  SELECT COALESCE((
    SELECT auth.uid() IS NOT NULL
       AND (
         s.user_id = auth.uid()
         OR (
           COALESCE(public.is_shadchan_or_admin(), false)
           AND NOT public.student_hidden_until_approved(s.id)
           AND NOT public.student_display_restricted(s.id)
         )
       )
      FROM public.students s
     WHERE s.id = p_student_id AND s.deleted_at IS NULL
  ), false);
$$;

ALTER FUNCTION public.can_see_card_proposals(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.can_see_card_proposals(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_card_proposal_count(p_student_id uuid) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  SELECT CASE WHEN public.can_see_card_proposals(p_student_id) THEN (
    SELECT count(*)::integer FROM public.shidduch_events e
     WHERE e.student_id = p_student_id AND e.kind = 'offer_sent'
  ) END;
$$;

ALTER FUNCTION public.get_card_proposal_count(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_card_proposal_count(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_card_proposal_count(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_card_proposals(p_student_id uuid)
    RETURNS TABLE(shidduch_id uuid, sent_at timestamptz, other_student_name text, status text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  SELECT e.shidduch_id, e.created_at, e.other_student_name, sh.status::text
    FROM public.shidduch_events e
    LEFT JOIN public.shidduchim sh ON sh.id = e.shidduch_id
   WHERE e.student_id = p_student_id
     AND e.kind = 'offer_sent'
     AND e.shadchan_id = auth.uid()
     AND public.can_see_card_proposals(p_student_id)
   ORDER BY e.created_at DESC
   LIMIT 50;
$$;

ALTER FUNCTION public.get_my_card_proposals(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_my_card_proposals(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_card_proposals(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ── rollback ─────────────────────────────────────────────────────────
--   DROP FUNCTION IF EXISTS public.get_my_card_proposals(uuid);
--   DROP FUNCTION IF EXISTS public.get_card_proposal_count(uuid);
--   DROP FUNCTION IF EXISTS public.can_see_card_proposals(uuid);
--   NOTIFY pgrst, 'reload schema';
