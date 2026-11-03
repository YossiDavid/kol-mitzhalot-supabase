-- כרטיס צד שלישי (card_for = 'other') לא יוצא מהסיווג בלי מנהל.
-- עד עכשיו ה-trigger איפס אישורים רק במעבר *אל* 'other'. ממלא צד שלישי
-- (או שדכן דרך update_full_student_profile) יכול היה לשנות card_for ל-'child'
-- או 'self', וכך לעקוף את שני אישורי ההנהלה (תצוגה מלאה והצעות).
-- כאן: מי שאינו מנהל / service role לא משנה card_for מ-'other' כל עוד שני
-- האישורים לא ניתנו.
--
-- ROLLBACK: להריץ מחדש את סעיף 2 ב-20261013090000_third_party_cards.sql.

-- ושינוי של כרטיס אל 'other' מאפס אישורים ישנים (מתחיל לא מאושר).
CREATE OR REPLACE FUNCTION public.enforce_third_party_approval_lock() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_is_trusted boolean := auth.uid() IS NULL OR public.is_admin();
  v_approvals_changed boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_approvals_changed :=
      NEW.third_party_full_display_approved_at IS NOT NULL
      OR NEW.third_party_full_display_approved_by IS NOT NULL
      OR NEW.third_party_proposals_approved_at IS NOT NULL
      OR NEW.third_party_proposals_approved_by IS NOT NULL;
  ELSE
    v_approvals_changed :=
      NEW.third_party_full_display_approved_at IS DISTINCT FROM OLD.third_party_full_display_approved_at
      OR NEW.third_party_full_display_approved_by IS DISTINCT FROM OLD.third_party_full_display_approved_by
      OR NEW.third_party_proposals_approved_at IS DISTINCT FROM OLD.third_party_proposals_approved_at
      OR NEW.third_party_proposals_approved_by IS DISTINCT FROM OLD.third_party_proposals_approved_by;
  END IF;

  IF v_approvals_changed AND NOT v_is_trusted THEN
    RAISE EXCEPTION 'third_party_approval_forbidden' USING ERRCODE = '42501';
  END IF;

  -- יציאה מ-'other' בלי שני אישורי ההנהלה: מנהל בלבד
  IF TG_OP = 'UPDATE' AND NOT v_is_trusted
     AND OLD.card_for = 'other' AND NEW.card_for IS DISTINCT FROM 'other'
     AND (OLD.third_party_full_display_approved_at IS NULL
          OR OLD.third_party_proposals_approved_at IS NULL) THEN
    RAISE EXCEPTION 'third_party_card_for_locked' USING ERRCODE = '42501';
  END IF;

  -- עבר ל-'other' עכשיו: האישורים של פעם קודמת לא חלים
  IF TG_OP = 'UPDATE' AND NOT v_approvals_changed
     AND NEW.card_for = 'other' AND OLD.card_for IS DISTINCT FROM 'other' THEN
    NEW.third_party_full_display_approved_at := NULL;
    NEW.third_party_full_display_approved_by := NULL;
    NEW.third_party_proposals_approved_at := NULL;
    NEW.third_party_proposals_approved_by := NULL;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.enforce_third_party_approval_lock() OWNER TO postgres;

