-- לכהן לא מציעים גרושה: מיועד שסומן כהן (students.is_kohen = true) אינו
-- מוצע למיועדת שהסטטוס שלה "גרושה" (personal_status = 'divorced').
--
-- נאכף בטריגר BEFORE על shidduchim, כך שאי אפשר לעקוף אותו בכתיבה ישירה
-- (RLS של השדכן) וגם לא דרך ה-routes (service role). הכלל חל על:
--   - יצירת הצעה (גם טיוטה);
--   - עדכון טיוטה, החלפת כרטיס בטיוטה;
--   - כל שליחה: טיוטה/דחויה שעוברת לסטטוס פעיל, היקף שליחה חדש (השלמת הצד
--     השני) או חותמת שליחה חדשה.
-- כך גם טיוטה שנשמרה לפני שהמיועדת הפכה לגרושה (או לפני שהמיועד סומן כהן)
-- נחסמת בשליחה. הצעה שכבר נשלחה ורק מתקדמת בסטטוס (תגובות ההורים, השדכן
-- מעדכן מצב) אינה נחסמת - הכלל נבדק ברגע ההצעה.
--
-- הקוד: kohen_divorced (ERRCODE P0001), ממופה בקוד ל-ProposalBlock
-- (features/shidduchim/lib/proposal-gate.ts).
-- אידמפוטנטית; להחלה: psql --single-transaction -v ON_ERROR_STOP=1 -f <file>

CREATE OR REPLACE FUNCTION public.enforce_shidduch_kohen_rule() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_is_kohen    boolean;
  v_is_divorced boolean;
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.status::text NOT IN ('draft', 'rejected')
     AND NEW.status::text <> 'draft'
     AND NEW.groom_id IS NOT DISTINCT FROM OLD.groom_id
     AND NEW.bride_id IS NOT DISTINCT FROM OLD.bride_id
     AND NEW.recipient_scope IS NOT DISTINCT FROM OLD.recipient_scope
     AND NEW.sent_at IS NOT DISTINCT FROM OLD.sent_at THEN
    -- הצעה פעילה שרק מתקדמת: אין כאן הצעה חדשה
    RETURN NEW;
  END IF;

  SELECT COALESCE(s.is_kohen, false) INTO v_is_kohen
    FROM public.students s WHERE s.id = NEW.groom_id;
  IF NOT COALESCE(v_is_kohen, false) THEN
    RETURN NEW;
  END IF;

  SELECT s.personal_status::text = 'divorced' INTO v_is_divorced
    FROM public.students s WHERE s.id = NEW.bride_id;
  IF COALESCE(v_is_divorced, false) THEN
    RAISE EXCEPTION 'kohen_divorced' USING ERRCODE = 'P0001', DETAIL = 'bride',
      HINT = 'לא ניתן להציע מיועדת גרושה למיועד כהן';
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.enforce_shidduch_kohen_rule() OWNER TO postgres;
-- פונקציית טריגר בלבד: אין סיבה שתיקרא ישירות
REVOKE ALL ON FUNCTION public.enforce_shidduch_kohen_rule() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trigger_enforce_shidduch_kohen_rule ON public.shidduchim;
CREATE TRIGGER trigger_enforce_shidduch_kohen_rule
  BEFORE INSERT OR UPDATE ON public.shidduchim
  FOR EACH ROW EXECUTE FUNCTION public.enforce_shidduch_kohen_rule();

-- ── rollback ─────────────────────────────────────────────────────────
--   DROP TRIGGER IF EXISTS trigger_enforce_shidduch_kohen_rule ON public.shidduchim;
--   DROP FUNCTION IF EXISTS public.enforce_shidduch_kohen_rule();
