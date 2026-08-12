-- הורים (מנהלי כרטיס) יכולים לצפות בשידוכים שבהם מעורך ילד שלהם
CREATE POLICY "Parents can view shidduchim involving their students"
ON public.shidduchim
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = shidduchim.groom_id AND s.user_id = (SELECT auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = shidduchim.bride_id AND s.user_id = (SELECT auth.uid())
  )
);

COMMENT ON POLICY "Parents can view shidduchim involving their students" ON public.shidduchim IS
  'מאפשר למנהל הכרטיס (user_id) של המיועד או המיועדת לראות את רשומת השידוך — לדוגמה מקישור במייל';
;
