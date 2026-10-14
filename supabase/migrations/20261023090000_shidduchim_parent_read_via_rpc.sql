-- מנהל כרטיס (הורה) אינו קורא עוד את שורת shidduchim ישירות.
--
-- עד היום המדיניות "Parents can view shidduchim involving their students"
-- חשפה להורה את השורה כולה, כולל ההערה שהשדכן כתב לצד השני (note_for_groom /
-- note_for_bride) ודגלי השיתוף. האפליקציה מציגה להורה רק את ההערה לצד שלו,
-- דרך get_my_shidduch_proposals (SECURITY DEFINER), שמחזירה בדיוק את מה שמותר:
-- ההצעה, הצד שלו, ההערה אליו, שמות שני הכרטיסים והתגובה שלו. כל זרימות ההורה
-- (עמוד ההצעות, עמוד ההצעה, תגובה דרך respond_to_shidduch, התגובות ב-
-- shidduch_responses, שרשור הצ'אט וכותרתו) כבר עוברות דרך פונקציות כאלה, או -
-- בפס ההקשר של הצ'אט - דרך הקוד שעולה יחד עם המיגרציה הזו.
--
-- להחיל אחרי שהקוד (features/chats/lib/use-context-targets.ts שקורא את ההצעה
-- דרך get_my_shidduch_proposals) עלה. קוד ישן מול המסד הזה: בשרשור צ'אט על
-- הצעה ההורה רואה "ההצעה הוסרה מהמערכת" במקום הקישור להצעה; שום דף אינו נכשל.
-- שדכן ההצעה ומנהלים - בלי שינוי.
-- אידמפוטנטית. להחלה: psql --single-transaction -v ON_ERROR_STOP=1 -f <file>

DROP POLICY IF EXISTS "Parents can view shidduchim involving their students" ON public.shidduchim;

NOTIFY pgrst, 'reload schema';

-- ── rollback ─────────────────────────────────────────────────────────
--   DROP POLICY IF EXISTS "Parents can view shidduchim involving their students" ON public.shidduchim;
--   CREATE POLICY "Parents can view shidduchim involving their students" ON public.shidduchim
--     FOR SELECT TO authenticated
--     USING (
--       status <> 'draft'::shidduch_status_enum
--       AND (
--         (
--           recipient_scope = ANY (ARRAY['both'::text, 'groom_only'::text])
--           AND EXISTS (
--             SELECT 1 FROM public.students s
--             WHERE s.id = shidduchim.groom_id AND s.user_id = (SELECT auth.uid())
--           )
--         )
--         OR (
--           recipient_scope = ANY (ARRAY['both'::text, 'bride_only'::text])
--           AND EXISTS (
--             SELECT 1 FROM public.students s
--             WHERE s.id = shidduchim.bride_id AND s.user_id = (SELECT auth.uid())
--           )
--         )
--       )
--     );
--   NOTIFY pgrst, 'reload schema';
