-- ════════════════════════════════════════════════════════════════════════
-- הקשחת אבטחה, סבב 2.
--
--  1. הצהרה עצמית כאיש צוות / שדכן מאושר: בקשת ההצטרפות נכתבת מהדפדפן
--     (staff_info / shadchanim_info / staff_institutions), ופונקציות הגישה
--     סמכו על application_status ועל שיוך למוסד בלבד - בלי לבדוק תפקיד.
--     כל משתמש יכול היה לכתוב לעצמו שורה מאושרת ולקרוא כרטיסי מוסד שלם.
--     התיקון: (א) פונקציות הגישה דורשות גם את התפקיד האמיתי (app_metadata);
--     (ב) טריגר שמונע ממשתמש רגיל לכתוב עמודות החלטה; (ג) staff_institutions
--     ניתנת לשינוי עצמי רק בזמן הגשת הבקשה.
--  2. שידוך פעיל לא ניתן להצמדה מחדש לכרטיס אחר (עקיפת שערי הכרטיס).
--  3. הכנסת שידוך דורשת תפקיד שדכן/מנהל (וכך גם עדכון ומחיקה).
--  4. אין יותר יצירת חדרי צ'אט ישירות מהלקוח (חדר "רפאים" בלי משתתפים);
--     chat_find_or_create_room מתקן לבד חדר שחסר בו משתתף.
--  5. שדות שרת ב-chat_messages (created_at / edited_at / message_id) לא
--     נשלטים עוד ע"י הלקוח.
--
-- פונקציות ופוליסות שהסתמכו על application_status / שיוך מוסד להחלטת גישה
-- (נסרקו בקטלוג החי: pg_proc.prosrc ו-pg_policies):
--   * staff_can_access_student  -> students SELECT, student_notes INSERT,
--                                  groom_photo_withheld              [תוקן]
--   * is_approved_staff         -> (לא בשימוש ב-RLS כרגע)             [תוקן]
--   * is_approved_shadchan      -> forum_posts / forum_replies /
--                                  forum_likes INSERT                 [תוקן]
--   * staff_institutions: כתיבה עצמית ללא הגבלה                      [תוקן]
--   * staff_info / shadchanim_info: כתיבה עצמית של עמודות החלטה       [תוקן]
--   * shadchan_public_profiles, notify_*: קוראות את שורות הבקשה לתצוגה
--     והתראות בלבד, לא להחלטת גישה - ללא שינוי.
--
-- אידמפוטנטית.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1א. פונקציות גישה: סטטוס מאושר + תפקיד אמיתי ───────────────────
CREATE OR REPLACE FUNCTION public.staff_can_access_student(uid uuid, sid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
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
        AND sinst.user_id = uid
        AND si.application_status = 'approved'
    );
$$;

CREATE OR REPLACE FUNCTION public.is_approved_staff(uid uuid) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  SELECT public.has_role(uid, 'staff')
    AND EXISTS (
      SELECT 1 FROM public.staff_info
      WHERE user_id = uid AND application_status = 'approved'
    );
$$;

CREATE OR REPLACE FUNCTION public.is_approved_shadchan(uid uuid) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  SELECT public.has_role(uid, 'shadchan')
    AND EXISTS (
      SELECT 1 FROM public.shadchanim_info
      WHERE user_id = uid AND application_status = 'approved'
    );
$$;

-- ── 1ב. עמודות החלטה: רק מנהל / service role ───────────────────────
-- משתמש רגיל (auth.uid() לא ריק ואינו מנהל):
--   INSERT  -> הסטטוס תמיד 'pending', שאר עמודות ההחלטה ריקות.
--   UPDATE  -> הסטטוס יכול רק להישאר או לעבור מ-null/rejected ל-pending
--              (הגשה מחדש); approved_at / rejected_at / rejected_reason נשמרים.
--              בשורה מאושרת גם institution_id (עמודת השיוך הישנה) נעול.
-- שינוי אסור מבוטל בשקט (במקום חריגה): upsert של הטופס מריץ גם טריגר
-- INSERT על שורה קיימת, ושם אסור להפיל את הבקשה.
CREATE OR REPLACE FUNCTION public.guard_application_decision() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'auth'
    AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.application_status := 'pending';
    NEW.approved_at := NULL;
    NEW.rejected_at := NULL;
    NEW.rejected_reason := NULL;
    RETURN NEW;
  END IF;

  IF NEW.application_status IS DISTINCT FROM OLD.application_status
     AND NOT (NEW.application_status = 'pending'
              AND (OLD.application_status IS NULL OR OLD.application_status = 'rejected'))
  THEN
    NEW.application_status := OLD.application_status;
  END IF;

  NEW.approved_at := OLD.approved_at;
  NEW.rejected_at := OLD.rejected_at;
  NEW.rejected_reason := OLD.rejected_reason;

  IF TG_TABLE_NAME = 'staff_info' AND OLD.application_status = 'approved' THEN
    NEW.institution_id := OLD.institution_id;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.guard_application_decision() OWNER TO postgres;

DROP TRIGGER IF EXISTS trigger_guard_staff_info_decision ON public.staff_info;
CREATE TRIGGER trigger_guard_staff_info_decision
  BEFORE INSERT OR UPDATE ON public.staff_info
  FOR EACH ROW EXECUTE FUNCTION public.guard_application_decision();

DROP TRIGGER IF EXISTS trigger_guard_shadchanim_info_decision ON public.shadchanim_info;
CREATE TRIGGER trigger_guard_shadchanim_info_decision
  BEFORE INSERT OR UPDATE ON public.shadchanim_info
  FOR EACH ROW EXECUTE FUNCTION public.guard_application_decision();

-- ── 1ג. staff_institutions: שינוי עצמי רק בזמן הגשת הבקשה ───────────
-- אחרי אישור (או כשיש תפקיד staff) רק מנהל משנה שיוך. קריאה עצמית נשארת.
DROP POLICY IF EXISTS "Staff_institutions insert own or admin" ON public.staff_institutions;
DROP POLICY IF EXISTS "Staff_institutions update own or admin" ON public.staff_institutions;
DROP POLICY IF EXISTS "Staff_institutions delete own or admin" ON public.staff_institutions;

CREATE POLICY "Staff_institutions insert own or admin" ON public.staff_institutions
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      user_id = (SELECT auth.uid())
      AND NOT public.has_role((SELECT auth.uid()), 'staff')
      AND NOT EXISTS (
        SELECT 1 FROM public.staff_info si
        WHERE si.user_id = (SELECT auth.uid()) AND si.application_status = 'approved'
      )
    )
    OR public.is_admin()
  );

CREATE POLICY "Staff_institutions update own or admin" ON public.staff_institutions
  FOR UPDATE TO authenticated
  USING (
    (
      user_id = (SELECT auth.uid())
      AND NOT public.has_role((SELECT auth.uid()), 'staff')
      AND NOT EXISTS (
        SELECT 1 FROM public.staff_info si
        WHERE si.user_id = (SELECT auth.uid()) AND si.application_status = 'approved'
      )
    )
    OR public.is_admin()
  )
  WITH CHECK (
    (
      user_id = (SELECT auth.uid())
      AND NOT public.has_role((SELECT auth.uid()), 'staff')
      AND NOT EXISTS (
        SELECT 1 FROM public.staff_info si
        WHERE si.user_id = (SELECT auth.uid()) AND si.application_status = 'approved'
      )
    )
    OR public.is_admin()
  );

CREATE POLICY "Staff_institutions delete own or admin" ON public.staff_institutions
  FOR DELETE TO authenticated
  USING (
    (
      user_id = (SELECT auth.uid())
      AND NOT public.has_role((SELECT auth.uid()), 'staff')
      AND NOT EXISTS (
        SELECT 1 FROM public.staff_info si
        WHERE si.user_id = (SELECT auth.uid()) AND si.application_status = 'approved'
      )
    )
    OR public.is_admin()
  );

-- ── 2. שידוך לא-טיוטה: הכרטיסים (והשדכן) קבועים ─────────────────────
-- שער הכרטיס נגזר מסטטוס / recipient_scope בלבד; שינוי groom_id / bride_id
-- בשורה פעילה העביר את ההצעה לכרטיס אחר (מושהה / מעבר למכסה) בלי בדיקה
-- ובלי יומן. טיוטות עדיין ניתנות לשינוי. שורה שנדחתה והוכנסה מחדש ע"י
-- נתיב השליחה (service role) מחליפה רק בעלות - לכן shadchan_id נעול רק
-- בסשן רגיל של משתמש שאינו מנהל.
CREATE OR REPLACE FUNCTION public.enforce_shidduch_card_gates() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_sides    text[];
  v_side     text;
  v_student  uuid;
  v_quota    record;
  v_pending  integer;
  v_uid      uuid := auth.uid();
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
$$;

-- יומן האירועים מגיב גם לשינוי כרטיס (בפועל נחסם למעלה; הגנה לעומק)
DROP TRIGGER IF EXISTS trigger_log_shidduch_events ON public.shidduchim;
CREATE TRIGGER trigger_log_shidduch_events
  AFTER INSERT OR UPDATE OF status, sent_at, recipient_scope, groom_id, bride_id
  ON public.shidduchim
  FOR EACH ROW EXECUTE FUNCTION public.log_shidduch_events();

-- ── 3. shidduchim: תפקיד שדכן/מנהל להכנסה, עדכון ומחיקה ──────────────
-- הצעות נוצרות ב-service role (נתיב ה-offer); לקוח רגיל לא מכניס שורות.
DROP POLICY IF EXISTS "Users can create shidduchim" ON public.shidduchim;
CREATE POLICY "Users can create shidduchim" ON public.shidduchim
  FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) = shadchan_id AND public.is_shadchan_or_admin()
  );

DROP POLICY IF EXISTS "Users can update their own shidduchim" ON public.shidduchim;
CREATE POLICY "Users can update their own shidduchim" ON public.shidduchim
  FOR UPDATE
  USING (
    (SELECT auth.uid()) = shadchan_id AND public.is_shadchan_or_admin()
  )
  WITH CHECK (
    (SELECT auth.uid()) = shadchan_id AND public.is_shadchan_or_admin()
  );

DROP POLICY IF EXISTS "Users can delete their own shidduchim" ON public.shidduchim;
CREATE POLICY "Users can delete their own shidduchim" ON public.shidduchim
  FOR DELETE
  USING (
    (SELECT auth.uid()) = shadchan_id AND public.is_shadchan_or_admin()
  );

-- ── 4. chat_rooms: יצירה רק דרך הפונקציות ───────────────────────────
DROP POLICY IF EXISTS "rooms_insert_creator_canonical" ON public.chat_rooms;
REVOKE INSERT ON public.chat_rooms FROM authenticated;
REVOKE INSERT ON public.chat_rooms FROM anon;

CREATE OR REPLACE FUNCTION public.chat_find_or_create_room(
  p_creator uuid, p_other uuid, p_kind text, p_student_id uuid, p_shidduch_id uuid, p_label text
) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  a   uuid;
  b   uuid;
  rid uuid;
BEGIN
  SELECT cp.user_a, cp.user_b INTO a, b FROM public.chat_canonical_pair(p_creator, p_other) cp;

  -- יצירות מקבילות לאותו חדר: נעילה לפי זוג+הקשר, ואז בדיקה ויצירה
  PERFORM pg_advisory_xact_lock(
    hashtext('chat_room_context'),
    hashtext(a::text || b::text || p_kind
             || COALESCE(p_student_id::text, '') || COALESCE(p_shidduch_id::text, ''))
  );

  SELECT r.room_id INTO rid
  FROM public.chat_rooms r
  WHERE r.user_a = a AND r.user_b = b
    AND r.context_kind = p_kind
    AND (p_kind <> 'student'  OR r.student_id  = p_student_id)
    AND (p_kind <> 'shidduch' OR r.shidduch_id = p_shidduch_id);

  IF rid IS NULL THEN
    INSERT INTO public.chat_rooms (user_a, user_b, created_by, context_kind, student_id, shidduch_id, context_label)
    VALUES (a, b, p_creator, p_kind, p_student_id, p_shidduch_id, p_label)
    RETURNING room_id INTO rid;
  END IF;

  -- גם לחדר קיים: חדר שחסר בו משתתף (למשל חדר שנוצר ישירות מהלקוח) מתוקן
  INSERT INTO public.chat_room_participants (room_id, user_id)
  VALUES (rid, p_creator), (rid, p_other)
  ON CONFLICT (room_id, user_id) DO NOTHING;

  RETURN rid;
END;
$$;

-- ── 5. chat_messages: שדות שרת ──────────────────────────────────────
-- הלקוח שולח רק room_id, sender_id, content, reply_to_message_id.
REVOKE INSERT ON public.chat_messages FROM authenticated;
GRANT INSERT (room_id, sender_id, content, reply_to_message_id)
  ON public.chat_messages TO authenticated;

-- הגנה לעומק אם ההרשאות ישתנו: בסשן משתמש הזמן והעריכה נקבעים בשרת
CREATE OR REPLACE FUNCTION public.chat_messages_force_server_fields() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.created_at := now();
    NEW.edited_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.chat_messages_force_server_fields() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_chat_messages_force_server_fields ON public.chat_messages;
CREATE TRIGGER trg_chat_messages_force_server_fields
  BEFORE INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.chat_messages_force_server_fields();
