-- הרשאת התמונות לרשימת כרטיסים בקריאה אחת (עומס על המסד).
--
-- התמונות הממוזערות ברשימה בדקו can_view_student_photo פעם לכל כרטיס: בפרודקשן
-- 87 אלף קריאות RPC. viewable_student_photo_ids מחזירה בבת אחת את הכרטיסים
-- שהצופה רשאי לראות את תמונותיהם, באותה פונקציה בדיוק (בלי לשכפל את הכלל),
-- ועם auth.uid() במקום מזהה שהפונה שולח.
--
-- ROLLBACK: DROP FUNCTION public.viewable_student_photo_ids(uuid[]);

CREATE OR REPLACE FUNCTION public.viewable_student_photo_ids(p_student_ids uuid[])
RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT DISTINCT t.id
    FROM unnest(p_student_ids[1:200]) AS t(id)
   WHERE t.id IS NOT NULL
     AND auth.uid() IS NOT NULL
     AND COALESCE(public.can_view_student_photo(auth.uid(), t.id), false);
$$;

ALTER FUNCTION public.viewable_student_photo_ids(uuid[]) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.viewable_student_photo_ids(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.viewable_student_photo_ids(uuid[]) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
