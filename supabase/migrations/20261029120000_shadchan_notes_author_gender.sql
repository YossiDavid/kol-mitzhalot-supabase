-- הערות שדכן על כרטיס: כותרת לפי מגדר הכותב ("השדכן הרב ..." / "השדכנית גב' ...")
-- וקישור לעמוד השדכן.
--
-- get_student_shadchan_notes: ההגדרה מ-20261006110000_shared_notes_and_auto_engagement.sql,
-- ובנוסף בסוף:
--   * author_gender - shadchanim_info.gender של הכותב (NULL כשלא ידוע / מנהל).
--   * author_has_profile - האם לכותב יש עמוד שדכן (is_contactable_shadchan,
--     אותה בדיקה של get_shadchan_public_profile) - רק אז הממשק מקשר אליו.
-- שינוי טיפוס ההחזרה מחייב DROP + CREATE; ההרשאות וההערה משוחזרות זהות.
--
-- אידמפוטנטית. להחלה: psql -v ON_ERROR_STOP=1 -f <file>

DROP FUNCTION IF EXISTS public.get_student_shadchan_notes(uuid);
CREATE FUNCTION public.get_student_shadchan_notes(p_student_id uuid)
RETURNS TABLE (
  id                 uuid,
  body               text,
  created_at         timestamptz,
  updated_at         timestamptz,
  author_id          uuid,
  author_name        text,
  author_gender      text,
  author_has_profile boolean
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
    public.is_contactable_shadchan(n.author_id)
  FROM public.student_notes n
  JOIN public.students s ON s.id = n.student_id AND s.deleted_at IS NULL
  LEFT JOIN auth.users u ON u.id = n.author_id
  LEFT JOIN public.user_profiles p ON p.id = n.author_id
  LEFT JOIN public.shadchanim_info si ON si.user_id = n.author_id
  WHERE n.student_id = p_student_id
    AND n.author_role IN ('shadchan', 'admin')
    AND public.is_shadchan_or_admin()
  ORDER BY n.created_at DESC;
$$;

ALTER FUNCTION public.get_student_shadchan_notes(uuid) OWNER TO postgres;

COMMENT ON FUNCTION public.get_student_shadchan_notes(uuid)
  IS 'הערות שדכן על כרטיס עם שם הכותב, המגדר שלו והאם יש לו עמוד שדכן. מחזירה שורות רק לשדכן/מנהל מחובר.';

REVOKE ALL ON FUNCTION public.get_student_shadchan_notes(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_student_shadchan_notes(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_student_shadchan_notes(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_shadchan_notes(uuid) TO service_role;

-- ── Rollback (להריץ ידנית) ──
-- DROP FUNCTION public.get_student_shadchan_notes(uuid); ולהחזיר את ההגדרה
-- שב-20261006110000_shared_notes_and_auto_engagement.sql (כולל ההרשאות).
