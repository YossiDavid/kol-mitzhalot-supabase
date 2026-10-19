-- כמה הצעות הוצעו לכל כרטיס בעמוד של רשימת המיועדים (תוספת בלבד, בטוח להחיל
-- לפני הקוד).
--
-- אותה הגדרה ואותה הרשאה כמו get_card_proposal_count
-- (20261026110000_card_proposal_counts.sql), לכמה כרטיסים בקריאה אחת: שורה לכל
-- מזהה, ו-proposal_count NULL כשהצופה אינו רשאי לראות את המספר
-- (can_see_card_proposals). עד 100 מזהים בקריאה (עמוד ברשימה הוא 50).
-- אידמפוטנטית. להחלה: psql --single-transaction -v ON_ERROR_STOP=1 -f <file>

CREATE OR REPLACE FUNCTION public.get_card_proposal_counts(p_student_ids uuid[])
    RETURNS TABLE(student_id uuid, proposal_count integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  SELECT ids.id,
         CASE WHEN public.can_see_card_proposals(ids.id) THEN (
           SELECT count(*)::integer FROM public.shidduch_events e
            WHERE e.student_id = ids.id AND e.kind = 'offer_sent'
         ) END
    FROM (
      SELECT DISTINCT unnest(p_student_ids[1:100]) AS id
    ) ids
   WHERE ids.id IS NOT NULL;
$$;

ALTER FUNCTION public.get_card_proposal_counts(uuid[]) OWNER TO postgres;
COMMENT ON FUNCTION public.get_card_proposal_counts(uuid[]) IS
  'מספר ההצעות שהוצעו לכל כרטיס (עד 100), לפי אותה הרשאה כמו get_card_proposal_count; NULL למי שאינו רשאי';
REVOKE ALL ON FUNCTION public.get_card_proposal_counts(uuid[]) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_card_proposal_counts(uuid[]) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ── rollback ─────────────────────────────────────────────────────────
--   DROP FUNCTION IF EXISTS public.get_card_proposal_counts(uuid[]);
--   NOTIFY pgrst, 'reload schema';
