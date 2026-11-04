-- הערות שדכן (גם של מנהל) על כרטיס "בלעדי למנהל", ממתין או צד שלישי מוגבל
-- היו גלויות לכל שדכן, ישירות מהטבלה וגם דרך get_student_shadchan_notes.
-- שתי הפונקציות מחזירות false לבעל הכרטיס ולמנהל, ולכן רק שדכן אחר מושפע.
-- הכותב עדיין רואה את ההערות שלו ("Student_notes select own").
--
-- ROLLBACK: להריץ מחדש את המדיניות והפונקציה מ-
--   20261106100000_card_report_extended_and_private_notes.sql

DROP POLICY IF EXISTS "Student_notes select shadchan notes for shadchanim" ON public.student_notes;
CREATE POLICY "Student_notes select shadchan notes for shadchanim" ON public.student_notes
  FOR SELECT TO authenticated
  USING (
    author_role IN ('shadchan', 'admin')
    AND NOT is_private
    AND public.is_shadchan_or_admin()
    -- כרטיס שאינו גלוי לצופה (ממתין / בלעדי למנהל / צד שלישי מוגבל)
    AND NOT public.student_hidden_until_approved(student_id)
    AND NOT public.student_display_restricted(student_id)
  );


CREATE OR REPLACE FUNCTION public.get_student_shadchan_notes(p_student_id uuid)
RETURNS TABLE (
  id                 uuid,
  body               text,
  created_at         timestamptz,
  updated_at         timestamptz,
  author_id          uuid,
  author_name        text,
  author_gender      text,
  author_has_profile boolean,
  author_is_admin    boolean,
  is_private         boolean
)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  SELECT
    n.id,
    n.body,
    n.created_at,
    n.updated_at,
    n.author_id,
    NULLIF(BTRIM(CONCAT_WS(' ',
      COALESCE(NULLIF(BTRIM(p.first_name), ''), NULLIF(BTRIM(u.raw_user_meta_data->>'firstName'), '')),
      COALESCE(NULLIF(BTRIM(p.last_name), ''),  NULLIF(BTRIM(u.raw_user_meta_data->>'lastName'), ''))
    )), ''),
    si.gender,
    public.is_contactable_shadchan(n.author_id),
    COALESCE(public.is_admin(n.author_id), false),
    n.is_private
  FROM public.student_notes n
  JOIN public.students s ON s.id = n.student_id AND s.deleted_at IS NULL
  LEFT JOIN auth.users u ON u.id = n.author_id
  LEFT JOIN public.user_profiles p ON p.id = n.author_id
  LEFT JOIN public.shadchanim_info si ON si.user_id = n.author_id
  WHERE n.student_id = p_student_id
    AND n.author_role IN ('shadchan', 'admin')
    AND public.is_shadchan_or_admin()
    -- חדש: הערה אישית - לכותב בלבד
    AND (NOT n.is_private OR n.author_id = auth.uid())
    -- כרטיס שאינו גלוי לצופה (ממתין / בלעדי למנהל / צד שלישי מוגבל)
    AND NOT public.student_hidden_until_approved(n.student_id)
    AND NOT public.student_display_restricted(n.student_id)
  ORDER BY n.created_at DESC;
$$;

ALTER FUNCTION public.get_student_shadchan_notes(uuid) OWNER TO postgres;

COMMENT ON FUNCTION public.get_student_shadchan_notes(uuid)
  IS 'הערות שדכן על כרטיס עם שם הכותב, המגדר שלו, האם יש לו עמוד שדכן והאם הוא מנהל. מחזירה שורות רק לשדכן/מנהל מחובר; הערה אישית (is_private) - לכותב בלבד.';

REVOKE ALL ON FUNCTION public.get_student_shadchan_notes(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_student_shadchan_notes(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_student_shadchan_notes(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_shadchan_notes(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
