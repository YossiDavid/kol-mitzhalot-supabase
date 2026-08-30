-- מעבר ל-multi-role: raw_user_meta_data.roles (מערך JSON) במקום שדה יחיד
-- raw_user_meta_data.role. הבאג שגרם למיגרציה הזו: אישור משתמש כאיש צוות
-- (app/api/v1/admin/staff/approve) כתב updateUserById({ user_metadata: { role: "staff" } })
-- שדרס לגמרי את ה-role הקודם - משתמש אמיתי (hello@shos.digital) היה shadchan
-- והפך ל-staff, ואיבד את כל הניווט וההרשאות של שדכן.
--
-- תאימות לאחור חובה: 14 המשתמשים הקיימים (12 shadchan, 1 staff, 1 admin) עדיין
-- כותבים/קוראים רק את raw_user_meta_data.role הישן. לכן:
--   1. מבצעים backfill חד-פעמי (אידמפוטנטי) שממלא roles ממנו קיים role.
--   2. פונקציות העזר למטה בודקות קודם את roles, ונופלות חזרה ל-role אם roles חסר.
--   3. כל נקודת כתיבה בקוד (TypeScript) ממשיכה לכתוב גם את role (הסקלר), מחושב
--      לפי סדר עדיפות admin > shadchan > staff > user, כדי שכל קוד שלא הומר
--      עדיין ימשיך לעבוד.

-- Backfill: כל משתמש עם role קיים אך ללא roles מקבל roles = מערך של איבר אחד.
-- אידמפוטנטי - אחרי הריצה הראשונה roles ? 'roles' יהיה true והתנאי לא יתאים שוב.
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  raw_user_meta_data,
  '{roles}',
  jsonb_build_array(raw_user_meta_data->>'role'),
  true
)
WHERE (raw_user_meta_data ? 'role')
  AND NOT (raw_user_meta_data ? 'roles');

-- פונקציית עזר משותפת: בודקת אם למשתמש יש תפקיד נתון, קודם במערך roles החדש
-- ובנפילה חזרה לשדה role הישן (יחיד). כל פונקציות ה-is_* למטה משתמשות בה
-- כדי שהלוגיקה תתקיים במקום אחד בלבד.
CREATE OR REPLACE FUNCTION public.has_role(uid uuid, role_name text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = uid
    AND (
      (raw_user_meta_data->'roles' ? role_name)
      OR (raw_user_meta_data->>'role' = role_name)
    )
  );
$$;

ALTER FUNCTION public.has_role(uuid, text) OWNER TO postgres;

COMMENT ON FUNCTION public.has_role(uuid, text) IS 'בודק אם למשתמש יש תפקיד נתון - תומך גם במערך roles החדש וגם בשדה role הישן (תאימות לאחור)';

GRANT ALL ON FUNCTION public.has_role(uuid, text) TO anon;
GRANT ALL ON FUNCTION public.has_role(uuid, text) TO authenticated;
GRANT ALL ON FUNCTION public.has_role(uuid, text) TO service_role;

-- להלן שכפול נאמן (אותה חתימה, LANGUAGE, STABLE/SECURITY DEFINER, search_path)
-- של פונקציות is_admin/is_admin(uuid)/is_shadchan מ-20260101000000_remote_baseline.sql,
-- כשהפרדיקט היחיד שהשתנה הוא הבדיקה עצמה - עכשיו דרך has_role. is_shadchan_or_admin()
-- לא נגעה בה כי היא רק מרכיבה את שתי הפונקציות האלה, כך שהיא יורשת את ההתנהגות
-- החדשה אוטומטית ולא נדרש שינוי.

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  SELECT public.has_role(auth.uid(), 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_admin(uid uuid) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    AS $$
  SELECT public.has_role(uid, 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_shadchan() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  SELECT public.has_role(auth.uid(), 'shadchan');
$$;
