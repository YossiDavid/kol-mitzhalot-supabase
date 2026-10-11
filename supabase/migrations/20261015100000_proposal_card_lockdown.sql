-- כרטיס שנצפה דרך הצעת שידוך, שלב 2 מתוך 2: הסרת הגישה הישירה.
--
-- להחיל רק אחרי ש-20261015090000_proposal_card_rpc.sql הוחל והקוד שקורא את
-- כרטיס ההצעה דרך get_proposal_student_card עלה לאוויר. קוד ישן מול המסד
-- הזה: מי שקיבל הצעה יקבל "שגיאה בטעינת הפרופיל" בכרטיס של הצד השני.
--
-- מה משתנה: קבלת הצעה כבר אינה חושפת את שורת students של הצד השני ולא את
-- שורות הטבלאות המקושרות. מי שקיבל הצעה מקבל את הכרטיס רק דרך הפונקציה,
-- שמחזירה רשימת עמודות מפורשת לפי מה שהשדכן פתח. בעלים, שדכן, מנהל ואיש צוות
-- של המוסד - בלי שינוי. הפונקציות shidduch_reveals_student /
-- shidduch_reveals_medical נשארות (get_student_card_access והצ'אט לא נגעו בהן).
-- אידמפוטנטית; בלוק אחד, ולכן כשל משאיר את כל המדיניות כפי שהייתה.

DO $lockdown$
DECLARE
  v_table text;
BEGIN
  DROP POLICY IF EXISTS "Users can view own profile or shadchanim see all" ON public.students;
  CREATE POLICY "Users can view own profile or shadchanim see all" ON public.students
    FOR SELECT
    USING (
      deleted_at IS NULL
      AND (
        auth.uid() = user_id
        OR public.is_shadchan_or_admin()
        OR public.staff_can_access_student(auth.uid(), id)
      )
    );

  -- לימודים ותעסוקה: בעלים ושדכן/מנהל
  FOREACH v_table IN ARRAY ARRAY['education_history', 'employment_history'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Users read own students or shadchanim see all" ON public.%I', v_table);
    EXECUTE format($f$
      CREATE POLICY "Users read own students or shadchanim see all" ON public.%1$I
        FOR SELECT
        USING (
          public.is_shadchan_or_admin()
          OR EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = %1$I.student_id AND s.user_id = auth.uid()
          )
        )
    $f$, v_table);
  END LOOP;

  -- הטבלאות הרגישות: כמו ב-20261013090000_third_party_cards.sql, בלי ההצעה
  FOREACH v_table IN ARRAY ARRAY['previous_partners', 'references', 'partner_preferences', 'medical_records'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Users read own students or shadchanim see all" ON public.%I', v_table);
    EXECUTE format($f$
      CREATE POLICY "Users read own students or shadchanim see all" ON public.%1$I
        FOR SELECT
        USING (
          (
            public.is_shadchan_or_admin()
            AND NOT public.student_display_restricted(student_id)
          )
          OR EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = %1$I.student_id AND s.user_id = auth.uid()
          )
        )
    $f$, v_table);
  END LOOP;
END
$lockdown$;

NOTIFY pgrst, 'reload schema';

-- ── rollback ─────────────────────────────────────────────────────────
-- מחזיר את המדיניות בדיוק כפי שהייתה אחרי 20261013090000_third_party_cards.sql.
--
--   DO $rollback$
--   DECLARE
--     v_table text;
--     v_reveal text;
--   BEGIN
--     DROP POLICY IF EXISTS "Users can view own profile or shadchanim see all" ON public.students;
--     CREATE POLICY "Users can view own profile or shadchanim see all" ON public.students
--       FOR SELECT
--       USING (
--         deleted_at IS NULL
--         AND (
--           auth.uid() = user_id
--           OR public.is_shadchan_or_admin()
--           OR public.staff_can_access_student(auth.uid(), id)
--           OR public.shidduch_reveals_student(auth.uid(), id)
--         )
--       );
--
--     FOREACH v_table IN ARRAY ARRAY['education_history', 'employment_history'] LOOP
--       EXECUTE format('DROP POLICY IF EXISTS "Users read own students or shadchanim see all" ON public.%I', v_table);
--       EXECUTE format($f$
--         CREATE POLICY "Users read own students or shadchanim see all" ON public.%1$I
--           FOR SELECT
--           USING (
--             public.is_shadchan_or_admin()
--             OR public.shidduch_reveals_student(auth.uid(), student_id)
--             OR EXISTS (
--               SELECT 1 FROM public.students s
--               WHERE s.id = %1$I.student_id AND s.user_id = auth.uid()
--             )
--           )
--       $f$, v_table);
--     END LOOP;
--
--     FOREACH v_table IN ARRAY ARRAY['previous_partners', 'references', 'partner_preferences', 'medical_records'] LOOP
--       v_reveal := CASE WHEN v_table = 'medical_records'
--         THEN 'public.shidduch_reveals_medical(auth.uid(), student_id)'
--         ELSE 'public.shidduch_reveals_student(auth.uid(), student_id)'
--       END;
--       EXECUTE format('DROP POLICY IF EXISTS "Users read own students or shadchanim see all" ON public.%I', v_table);
--       EXECUTE format($f$
--         CREATE POLICY "Users read own students or shadchanim see all" ON public.%1$I
--           FOR SELECT
--           USING (
--             (
--               (public.is_shadchan_or_admin() OR %2$s)
--               AND NOT public.student_display_restricted(student_id)
--             )
--             OR EXISTS (
--               SELECT 1 FROM public.students s
--               WHERE s.id = %1$I.student_id AND s.user_id = auth.uid()
--             )
--           )
--       $f$, v_table, v_reveal);
--     END LOOP;
--   END
--   $rollback$;
--   NOTIFY pgrst, 'reload schema';
