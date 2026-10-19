-- "מנהל מערכת" כשכותב הערת השדכן / הודעת הפורום הוא מנהל.
--
-- ההחלטה בזמן הקריאה לפי התפקיד הנוכחי של הכותב (public.is_admin(author_id)),
-- לא לפי student_notes.author_role שנשמר: מי שגם שדכן וגם מנהל כותב הערות
-- שנשמרות כ-'shadchan', ועדיין צריך להופיע כ"מנהל מערכת". הכיתוב עצמו נקבע
-- בממשק (features/shadchanim/lib/gender.ts) - כאן רק הדגל.
--
--   1. get_student_shadchan_notes: ההגדרה מ-20261029120000_shadchan_notes_author_gender.sql,
--      ובנוסף בסוף author_is_admin.
--   2. get_forum_author_names: ההגדרה מ-20261011110000_client_fixes_content.sql,
--      ובנוסף בסוף is_admin. shadchan_public_profiles מחזירה שורה לכל משתמש
--      קיים (LEFT JOIN ל-shadchanim_info), כך שגם מנהל בלי פרטי שדכן מקבל שורה.
-- שינוי טיפוס ההחזרה מחייב DROP + CREATE; ההרשאות וההערות משוחזרות זהות.
--
-- אידמפוטנטית. להחלה: psql -v ON_ERROR_STOP=1 -f <file>

-- ── 1. get_student_shadchan_notes ─────────────────────────────────
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
  author_has_profile boolean,
  author_is_admin    boolean
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
    COALESCE(public.is_admin(n.author_id), false)
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
  IS 'הערות שדכן על כרטיס עם שם הכותב, המגדר שלו, האם יש לו עמוד שדכן והאם הוא מנהל. מחזירה שורות רק לשדכן/מנהל מחובר.';

REVOKE ALL ON FUNCTION public.get_student_shadchan_notes(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_student_shadchan_notes(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_student_shadchan_notes(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_shadchan_notes(uuid) TO service_role;

-- ── 2. get_forum_author_names ─────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_forum_author_names(uuid[]);
CREATE FUNCTION public.get_forum_author_names(p_ids uuid[])
RETURNS TABLE (user_id uuid, display_name text, is_admin boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  SELECT pp.shadchan_id,
         NULLIF(BTRIM(CONCAT_WS(' ', pp.first_name, pp.last_name)), ''),
         COALESCE(public.is_admin(pp.shadchan_id), false)
  FROM public.shadchan_public_profiles(p_ids) pp
  WHERE public.is_approved_shadchan(auth.uid()) OR public.is_admin(auth.uid());
$$;

ALTER FUNCTION public.get_forum_author_names(uuid[]) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.get_forum_author_names(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_forum_author_names(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_forum_author_names(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_forum_author_names(uuid[]) TO service_role;

COMMENT ON FUNCTION public.get_forum_author_names(uuid[])
  IS 'שם תצוגה של כותבי הפורום והאם הכותב מנהל. רק לשדכן מאושר או מנהל';

-- ── Rollback (להריץ ידנית) ──
-- DROP FUNCTION public.get_student_shadchan_notes(uuid); ולהחזיר את ההגדרה
-- שב-20261029120000_shadchan_notes_author_gender.sql (כולל ההרשאות).
-- DROP FUNCTION public.get_forum_author_names(uuid[]); ולהחזיר את ההגדרה
-- שב-20261011110000_client_fixes_content.sql (כולל ההרשאות).
