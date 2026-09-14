-- תיעוד הצעות שידוך בחשבון ההורה ותגובה ישירה לשדכן ("shidduch_responses").
--
-- רקע: עד כה שליחת הצעה (app/api/v1/shidduchim/offer/route.ts) יצרה שורה
-- ב-shidduchim ושלחה מייל, אבל בחשבון ההורה לא הוצג דבר: קטע "הצעות
-- פתוחות" בדשבורד היה מקודד כרשימה ריקה, לדף /app/proposals לא היה קישור
-- בניווט, ולהורה לא הייתה שום דרך להגיב (אין לו מדיניות UPDATE על
-- shidduchim, ו-route הסטטוס פתוח לשדכן/מנהל בלבד).
--
-- מה נוסף כאן:
--   1. הידוק מדיניות הצפייה של ההורה ב-shidduchim - רק הצעות שנשלחו בפועל
--      ורק לצד שהיה נמען.
--   2. טבלת shidduch_responses - תגובה נוכחית אחת לכל צד בשידוך.
--   3. respond_to_shidduch - הדרך היחידה לכתוב תגובה, וגוזרת את סטטוס השידוך.
--   4. get_my_shidduch_proposals - ההצעות שהמשתמש קיבל, עם ההערה של הצד שלו בלבד.
--   5. התראה לשדכן על כל תגובה, ותיקון טריגר הסטטוס הקיים (כפילות + קישור).
--
-- בעלות על צד = students.user_id, בדיוק כמו במדיניות "Parents can view
-- shidduchim involving their students" ובמדיניות של students עצמה.
--
-- אידמפוטנטית - ניתן להריץ שוב.

-- ── 1. הידוק צפיית ההורה ב-shidduchim ─────────────────────────────
-- המדיניות הקודמת בדקה רק בעלות על אחד הכרטיסים, ולכן:
--   * הורה ראה גם טיוטות של שדכן (כולל הערות שטרם נשלחו),
--   * בהצעה שנשלחה לצד אחד בלבד (groom_only / bride_only), גם הצד השני -
--     שכלל לא קיבל אותה - ראה אותה ברשימת "ההצעות שלי".
-- recipient_scope נקבע רק בשליחה (NULL בטיוטה, וחוזר ל-NULL אם המייל נכשל),
-- ולכן הוא התנאי הנכון ל"ההצעה נשלחה לצד הזה". השם נשמר כדי לא לשבור
-- הפניות קיימות.
DROP POLICY IF EXISTS "Parents can view shidduchim involving their students" ON public.shidduchim;
CREATE POLICY "Parents can view shidduchim involving their students" ON public.shidduchim
  FOR SELECT TO authenticated
  USING (
    status <> 'draft'
    AND (
      (
        recipient_scope IN ('both', 'groom_only')
        AND EXISTS (
          SELECT 1 FROM public.students s
          WHERE s.id = shidduchim.groom_id
            AND s.user_id = (SELECT auth.uid())
        )
      )
      OR (
        recipient_scope IN ('both', 'bride_only')
        AND EXISTS (
          SELECT 1 FROM public.students s
          WHERE s.id = shidduchim.bride_id
            AND s.user_id = (SELECT auth.uid())
        )
      )
    )
  );

COMMENT ON POLICY "Parents can view shidduchim involving their students" ON public.shidduchim
  IS 'מנהל הכרטיס (user_id) רואה הצעה שנשלחה בפועל (לא טיוטה) ורק אם הצד שלו היה נמען לפי recipient_scope';

-- ── 2. הטבלה ─────────────────────────────────────────────────────
-- תגובה נוכחית אחת לכל צד (UNIQUE על shidduch_id, side) ולא היסטוריה:
-- הסטטוס של השידוך נגזר מהמצב הנוכחי של כל צד, וכל שינוי תגובה ממילא
-- נרשם כהתראה אצל השדכן (כולל ההודעה), כך שהמעקב אחרי השינויים לא הולך
-- לאיבוד. שיחה חופשית ממשיכה בצ'אט הקיים.
CREATE TABLE IF NOT EXISTS public.shidduch_responses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shidduch_id  uuid NOT NULL REFERENCES public.shidduchim(id) ON DELETE CASCADE,
  side         text NOT NULL CHECK (side IN ('groom', 'bride')),
  responder_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  response     text NOT NULL CHECK (response IN ('interested', 'more_info_needed', 'rejected')),
  message      text CHECK (message IS NULL OR char_length(message) <= 2000),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shidduch_id, side)
);

COMMENT ON TABLE  public.shidduch_responses              IS 'תגובת כל צד (הורי המיועד / הורי המיועדת) להצעת שידוך. נכתבת רק דרך respond_to_shidduch';
COMMENT ON COLUMN public.shidduch_responses.side         IS 'groom (צד המיועד) או bride (צד המיועדת)';
COMMENT ON COLUMN public.shidduch_responses.responder_id IS 'מי הגיב. ON DELETE SET NULL כדי שמחיקת משתמש לא תמחק את התגובה מתיק השידוך';
COMMENT ON COLUMN public.shidduch_responses.response     IS 'interested (מעוניינים), more_info_needed (מבקשים מידע נוסף), rejected (לא מעוניינים)';
COMMENT ON COLUMN public.shidduch_responses.message      IS 'הודעה חופשית לשדכן (אופציונלי)';
COMMENT ON COLUMN public.shidduch_responses.updated_at   IS 'מתי התגובה הנוכחית נקבעה. created_at = התגובה הראשונה של הצד';

-- ── 3. מי מנהל כל צד ─────────────────────────────────────────────
-- מקור אמת אחד ל"מי בעל הצד" עבור ה-RLS וה-RPC. SECURITY DEFINER כדי
-- שבדיקת ה-RLS לא תהיה תלויה במדיניות של students ו-shidduchim.
CREATE OR REPLACE FUNCTION public.shidduch_side_owner(p_shidduch_id uuid, p_side text) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  SELECT s.user_id
  FROM public.shidduchim sh
  JOIN public.students s
    ON s.id = CASE p_side WHEN 'groom' THEN sh.groom_id WHEN 'bride' THEN sh.bride_id END
  WHERE sh.id = p_shidduch_id
    AND s.deleted_at IS NULL;
$$;

ALTER FUNCTION public.shidduch_side_owner(uuid, text) OWNER TO postgres;

COMMENT ON FUNCTION public.shidduch_side_owner(uuid, text)
  IS 'מחזיר את user_id של מנהל הכרטיס בצד הנתון (groom/bride) של השידוך, או NULL';

REVOKE ALL ON FUNCTION public.shidduch_side_owner(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.shidduch_side_owner(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.shidduch_side_owner(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shidduch_side_owner(uuid, text) TO service_role;

-- ── 4. RLS ───────────────────────────────────────────────────────
ALTER TABLE public.shidduch_responses ENABLE ROW LEVEL SECURITY;

-- הורה רואה רק את תגובת הצד שלו (לא את תגובת הצד השני), השדכן רואה את
-- כל התגובות לשידוכים שלו, ומנהל רואה הכל.
DROP POLICY IF EXISTS "Shidduch_responses select side owner, shadchan or admin" ON public.shidduch_responses;
CREATE POLICY "Shidduch_responses select side owner, shadchan or admin" ON public.shidduch_responses
  FOR SELECT TO authenticated
  USING (
    public.shidduch_side_owner(shidduch_id, side) = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.shidduchim sh
      WHERE sh.id = shidduch_responses.shidduch_id
        AND sh.shadchan_id = (SELECT auth.uid())
    )
    OR public.is_admin()
  );

-- אין מדיניות INSERT/UPDATE/DELETE בכוונה: כתיבה רק דרך respond_to_shidduch
-- (SECURITY DEFINER), שבודקת בעלות, נמענות ומצב ההצעה וגוזרת את הסטטוס.
-- ברירת המחדל של Supabase מעניקה ALL לכל טבלה חדשה, ולכן מצמצמים במפורש.
REVOKE ALL ON TABLE public.shidduch_responses FROM anon;
REVOKE ALL ON TABLE public.shidduch_responses FROM authenticated;
GRANT SELECT ON TABLE public.shidduch_responses TO authenticated;
GRANT ALL ON TABLE public.shidduch_responses TO service_role;

-- ── 5. תגובה להצעה ───────────────────────────────────────────────
-- כללי גזירת הסטטוס של השידוך מתוך תגובות הצדדים (אחרי שמירת התגובה):
--   א. צד כלשהו "לא מעוניינים"           → rejected
--   ב. אחרת, צד כלשהו "מבקשים מידע נוסף"  → more_info_needed
--   ג. אחרת (כל מי שהגיב "מעוניינים")    → interested
--   ד. אם השדכן כבר קידם את השידוך ל-in_progress, הוא נשאר in_progress
--      אלא אם התוצאה היא rejected - כדי שלחיצה חוזרת של הורה לא תחזיר
--      שידוך מתקדם אחורה.
-- מתי אסור להגיב:
--   * טיוטה, או צד שלא היה נמען לפי recipient_scope - ההצעה לא נשלחה אליו.
--   * completed - השידוך נסגר.
--   * rejected - מותר רק לצד שבעצמו דחה (חזרה בו); הצעה שנדחתה על ידי הצד
--     השני או נסגרה על ידי השדכן לא נפתחת מחדש על ידי הורה.
CREATE OR REPLACE FUNCTION public.respond_to_shidduch(
  p_shidduch_id uuid,
  p_side        text,
  p_response    text,
  p_message     text DEFAULT NULL
) RETURNS public.shidduch_status_enum
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_sh      public.shidduchim%ROWTYPE;
  v_message text := NULLIF(BTRIM(p_message), '');
  v_derived public.shidduch_status_enum;
  v_next    public.shidduch_status_enum;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '28000';
  END IF;
  IF p_side IS NULL OR p_side NOT IN ('groom', 'bride') THEN
    RAISE EXCEPTION 'invalid_side' USING ERRCODE = '22023';
  END IF;
  IF p_response IS NULL OR p_response NOT IN ('interested', 'more_info_needed', 'rejected') THEN
    RAISE EXCEPTION 'invalid_response' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_message) > 2000 THEN
    RAISE EXCEPTION 'message_too_long' USING ERRCODE = '22001';
  END IF;

  -- FOR UPDATE: שני הצדדים עשויים להגיב במקביל, והגזירה חייבת לראות את
  -- שתי התגובות ולא לדרוס זו את זו.
  SELECT * INTO v_sh FROM public.shidduchim WHERE id = p_shidduch_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'shidduch_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- בעלות נבדקת לפני כל בדיקת מצב, כדי לא לחשוף לזר את מצב ההצעה.
  IF public.shidduch_side_owner(v_sh.id, p_side) IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'not_side_owner' USING ERRCODE = '42501';
  END IF;

  IF v_sh.status = 'draft'
     OR v_sh.recipient_scope IS NULL
     OR v_sh.recipient_scope NOT IN ('both', p_side || '_only') THEN
    RAISE EXCEPTION 'side_not_recipient' USING ERRCODE = '42501';
  END IF;

  IF v_sh.status = 'completed'
     OR (
       v_sh.status = 'rejected'
       AND NOT EXISTS (
         SELECT 1 FROM public.shidduch_responses r
         WHERE r.shidduch_id = v_sh.id
           AND r.side = p_side
           AND r.response = 'rejected'
       )
     ) THEN
    RAISE EXCEPTION 'shidduch_closed' USING ERRCODE = '55000';
  END IF;

  INSERT INTO public.shidduch_responses (shidduch_id, side, responder_id, response, message)
  VALUES (v_sh.id, p_side, v_uid, p_response, v_message)
  ON CONFLICT (shidduch_id, side) DO UPDATE
    SET responder_id = EXCLUDED.responder_id,
        response     = EXCLUDED.response,
        message      = EXCLUDED.message,
        updated_at   = now();

  SELECT CASE
           WHEN bool_or(r.response = 'rejected')         THEN 'rejected'
           WHEN bool_or(r.response = 'more_info_needed') THEN 'more_info_needed'
           ELSE 'interested'
         END::public.shidduch_status_enum
  INTO v_derived
  FROM public.shidduch_responses r
  WHERE r.shidduch_id = v_sh.id;

  v_next := CASE
    WHEN v_sh.status = 'in_progress' AND v_derived <> 'rejected' THEN v_sh.status
    ELSE v_derived
  END;

  IF v_next IS DISTINCT FROM v_sh.status THEN
    -- מסמן לטריגר notify_shidduch_response שהשינוי בא מתגובת הורה, שעליה
    -- כבר נוצרה התראה מפורטת (צד + תגובה + הודעה). מקומי לטרנזקציה, ומאופס
    -- מיד כדי לא להשתיק עדכונים אחרים באותה טרנזקציה.
    PERFORM set_config('app.shidduch_status_source', 'parent_response', true);
    UPDATE public.shidduchim
       SET status = v_next, updated_at = now()
     WHERE id = v_sh.id;
    PERFORM set_config('app.shidduch_status_source', '', true);
  END IF;

  RETURN v_next;
END;
$$;

ALTER FUNCTION public.respond_to_shidduch(uuid, text, text, text) OWNER TO postgres;

COMMENT ON FUNCTION public.respond_to_shidduch(uuid, text, text, text)
  IS 'תגובת מנהל כרטיס להצעת שידוך בשם הצד שלו. בודקת בעלות ונמענות, שומרת תגובה נוכחית לצד וגוזרת את סטטוס השידוך';

REVOKE ALL ON FUNCTION public.respond_to_shidduch(uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.respond_to_shidduch(uuid, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.respond_to_shidduch(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_shidduch(uuid, text, text, text) TO service_role;

-- ── 6. ההצעות שהמשתמש קיבל ───────────────────────────────────────
-- שורה לכל (שידוך, צד) שהמשתמש מנהל ושנשלח אליו. מחזירה רק את ההערה של
-- הצד של המשתמש, ורק פרטי בסיס על הצד השני (שם, עיר, תאריך לידה - פחות
-- ממה שכרטיס המיועד הציבורי חושף ממילא), כי מדיניות students לא מאפשרת
-- להורה לקרוא את כרטיס הצד השני.
CREATE OR REPLACE FUNCTION public.get_my_shidduch_proposals(
  p_shidduch_id uuid    DEFAULT NULL,
  p_open_only   boolean DEFAULT false,
  p_limit       integer DEFAULT NULL
) RETURNS TABLE (
  shidduch_id         uuid,
  side                text,
  status              public.shidduch_status_enum,
  shadchan_id         uuid,
  shadchan_first_name text,
  shadchan_last_name  text,
  note                text,
  sent_at             timestamptz,
  created_at          timestamptz,
  my_student_id       uuid,
  my_first_name       text,
  my_last_name        text,
  other_student_id    uuid,
  other_first_name    text,
  other_last_name     text,
  other_city          text,
  other_birth_date    date,
  my_response         text,
  my_response_message text,
  my_responded_at     timestamptz
)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
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
$$;

ALTER FUNCTION public.get_my_shidduch_proposals(uuid, boolean, integer) OWNER TO postgres;

COMMENT ON FUNCTION public.get_my_shidduch_proposals(uuid, boolean, integer)
  IS 'הצעות השידוך שנשלחו למשתמש המחובר כמנהל כרטיס, שורה לכל צד, עם ההערה של הצד שלו בלבד ותגובתו הנוכחית';

REVOKE ALL ON FUNCTION public.get_my_shidduch_proposals(uuid, boolean, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_shidduch_proposals(uuid, boolean, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_shidduch_proposals(uuid, boolean, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_shidduch_proposals(uuid, boolean, integer) TO service_role;

-- ── 7. תגובה חדשה → השדכן ────────────────────────────────────────
-- כמו שאר ההתראות: טריגר ולא קוד שרת. מתריע על כל תגובה חדשה או שינוי
-- תגובה/הודעה, ומדלג על שמירה חוזרת זהה (לחיצה כפולה).
CREATE OR REPLACE FUNCTION public.notify_shidduch_side_response() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  v_shadchan uuid;
  v_groom    text;
  v_bride    text;
  v_side     text;
  v_label    text;
  v_body     text;
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.response = NEW.response
     AND OLD.message IS NOT DISTINCT FROM NEW.message THEN
    RETURN NEW;
  END IF;

  SELECT
    sh.shadchan_id,
    NULLIF(BTRIM(COALESCE(g.first_name, '') || ' ' || COALESCE(g.last_name, '')), ''),
    NULLIF(BTRIM(COALESCE(b.first_name, '') || ' ' || COALESCE(b.last_name, '')), '')
  INTO v_shadchan, v_groom, v_bride
  FROM public.shidduchim sh
  LEFT JOIN public.students g ON g.id = sh.groom_id
  LEFT JOIN public.students b ON b.id = sh.bride_id
  WHERE sh.id = NEW.shidduch_id;

  v_side := CASE NEW.side WHEN 'groom' THEN 'צד המיועד' ELSE 'צד המיועדת' END;
  v_label := CASE NEW.response
    WHEN 'interested'       THEN 'מעוניינים בהצעה'
    WHEN 'more_info_needed' THEN 'מבקשים מידע נוסף'
    ELSE 'לא מעוניינים בהצעה'
  END;

  v_body := 'תגובה להצעה ' || COALESCE(v_groom, 'המיועד') || ' ו' || COALESCE(v_bride, 'המיועדת') || '.';
  IF NEW.message IS NOT NULL THEN
    v_body := v_body || ' הודעה: ' || left(NEW.message, 300);
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
  SELECT v_shadchan, 'shidduch_response', v_side || ': ' || v_label, v_body,
         '/app/shidduchim/' || NEW.shidduch_id::text, NEW.shidduch_id
  WHERE v_shadchan IS NOT NULL;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.notify_shidduch_side_response() OWNER TO postgres;

COMMENT ON FUNCTION public.notify_shidduch_side_response()
  IS 'מתריע לשדכן על תגובת צד להצעה: הצד, התגובה וההודעה, עם קישור לכרטיס השידוך.';

DROP TRIGGER IF EXISTS trigger_notify_shidduch_side_response ON public.shidduch_responses;
CREATE TRIGGER trigger_notify_shidduch_side_response
  AFTER INSERT OR UPDATE ON public.shidduch_responses
  FOR EACH ROW EXECUTE FUNCTION public.notify_shidduch_side_response();

-- ── 8. תיקון טריגר הסטטוס הקיים ──────────────────────────────────
-- (מ-20260907180000_notifications.sql) שלושה תיקונים:
--   * שינוי שנגזר מתגובת הורה כבר קיבל התראה מפורטת למעלה - מדלגים כדי
--     שהשדכן לא יקבל שתי התראות על אותה תגובה.
--   * שינוי שהשדכן עשה בעצמו (כשמזוהה דרך auth.uid()) - אין טעם להתריע לו.
--   * הקישור הצביע על /app/canvas; עכשיו לכרטיס השידוך עצמו.
CREATE OR REPLACE FUNCTION public.notify_shidduch_response() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  v_label text;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF current_setting('app.shidduch_status_source', true) = 'parent_response' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT DISTINCT FROM NEW.shadchan_id THEN
    RETURN NEW;
  END IF;

  v_label := CASE NEW.status::text
    WHEN 'interested'       THEN 'יש עניין בהצעה'
    WHEN 'more_info_needed' THEN 'התבקש מידע נוסף'
    WHEN 'rejected'         THEN 'ההצעה נדחתה'
    ELSE NULL
  END;

  IF v_label IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.create_notification(
    NEW.shadchan_id, 'shidduch_response',
    v_label,
    'התקבלה תגובה להצעת שידוך ששלחת.',
    '/app/shidduchim/' || NEW.id::text
  );

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.notify_shidduch_response() OWNER TO postgres;
