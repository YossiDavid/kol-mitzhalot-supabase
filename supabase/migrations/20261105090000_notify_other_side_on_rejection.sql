-- כשצד אחד משיב "לא מעוניינים", מנהל הכרטיס של הצד השני מקבל עדכון קצר
-- שההצעה לא תמשיך - בלי הסיבה ובלי ההודעה שנכתבה (דיסקרטיות). עד עכשיו רק
-- השדכן קיבל עדכון, וההצעה פשוט נעלמה למנהל הכרטיס מהצעות פתוחות.
--
-- נשלח רק לצד שקיבל את ההצעה בפועל (recipient_scope), ורק אם הוא עצמו
-- עוד לא השיב "לא מעוניינים". התראה אחת לכל שידוך (related_id = השידוך).

CREATE OR REPLACE FUNCTION public.notify_other_side_on_rejection()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_other_side  text := CASE NEW.side WHEN 'groom' THEN 'bride' ELSE 'groom' END;
  v_scope       text;
  v_other_card  uuid;
  v_partner_card uuid;
  v_owner       uuid;
  v_my_name     text;
  v_partner     text;
BEGIN
  IF NEW.response <> 'rejected' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.response = 'rejected' THEN
    RETURN NEW;
  END IF;

  SELECT sh.recipient_scope,
         CASE v_other_side WHEN 'groom' THEN sh.groom_id ELSE sh.bride_id END,
         CASE NEW.side WHEN 'groom' THEN sh.groom_id ELSE sh.bride_id END
    INTO v_scope, v_other_card, v_partner_card
    FROM public.shidduchim sh
   WHERE sh.id = NEW.shidduch_id;

  IF v_other_card IS NULL
     OR NOT (v_other_side = ANY (public.shidduch_scope_sides(v_scope))) THEN
    RETURN NEW;
  END IF;

  -- הצד השני כבר סגר בעצמו - אין מה לעדכן
  IF EXISTS (
    SELECT 1 FROM public.shidduch_responses r
     WHERE r.shidduch_id = NEW.shidduch_id
       AND r.side = v_other_side
       AND r.response = 'rejected'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT s.user_id, NULLIF(BTRIM(COALESCE(s.first_name, '')), '')
    INTO v_owner, v_my_name
    FROM public.students s
   WHERE s.id = v_other_card AND s.deleted_at IS NULL;

  IF v_owner IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT NULLIF(BTRIM(COALESCE(s.first_name, '') || ' ' || COALESCE(s.last_name, '')), '')
    INTO v_partner
    FROM public.students s
   WHERE s.id = v_partner_card;

  INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
  SELECT v_owner,
         'shidduch_closed_notice',
         'ההצעה לא תמשיך',
         'הצעת השידוך' || COALESCE(' של ' || v_my_name, '')
           || COALESCE(' עם ' || v_partner, '')
           || ' נסגרה: הצד השני השיב שאינו מעוניין להמשיך. בהצלחה בהמשך!',
         '/app/proposals',
         NEW.shidduch_id
   WHERE NOT EXISTS (
     SELECT 1 FROM public.notifications n
      WHERE n.user_id = v_owner
        AND n.type = 'shidduch_closed_notice'
        AND n.related_id = NEW.shidduch_id
   );

  RETURN NEW;
END;
$function$;

ALTER FUNCTION public.notify_other_side_on_rejection() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.notify_other_side_on_rejection() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trigger_notify_other_side_on_rejection
  AFTER INSERT OR UPDATE OF response ON public.shidduch_responses
  FOR EACH ROW EXECUTE FUNCTION public.notify_other_side_on_rejection();

-- ── rollback ─────────────────────────────────────────────────────────
--   להסיר את הטריגר trigger_notify_other_side_on_rejection ואת הפונקציה
