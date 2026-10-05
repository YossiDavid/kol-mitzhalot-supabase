-- ████████████████████████████████████████████████████████████████████████
-- ██  אזהרה: להריץ ידנית ורק אחרי שהקוד החדש עלה ויציב בפרודקשן.       ██
-- ██  לעולם לא לפני, ולעולם לא כחלק מ-supabase db push / ה-deploy.     ██
-- ██  הקוד הישן קורא תפקידים מ-user_metadata: מחיקתם לפני עליית הקוד   ██
-- ██  החדש הופכת את כל המנהלים והשדכנים למשתמשים רגילים.               ██
-- ██  סדר הפעולות המלא: docs/SECURITY_ROLES_DEPLOY.md                  ██
-- ████████████████████████████████████████████████████████████████████████
-- ════════════════════════════════════════════════════════════════════════
-- מיגרציית המשך ל-20261007100000_roles_to_app_metadata.sql.
--
-- !!! להריץ רק אחרי שהקוד החדש (שקורא תפקידים מ-app_metadata בלבד) כבר
-- !!! פרוס בפרודקשן ופועל. לא להריץ באותו deploy לפני שהקוד עלה.
--
-- למה לחכות: הקוד הישן שעדיין רץ בפרודקשן קורא תפקידים מ-user_metadata
-- (lib/user-role.ts). אם מוחקים את roles/role משם לפני שהקוד החדש עלה, כל
-- המנהלים והשדכנים נראים בקוד הישן כמשתמשים רגילים עד שה-deploy מסתיים.
-- אחרי שהקוד החדש עלה אין שום קורא של user_metadata.roles/role, והמחיקה
-- בטוחה (ואף מנקה ערכים שתוקף ניסה להזריק דרך updateUser).
--
-- בנוסף מוודאים שלכל מי שמחזיק roles/role ב-user_metadata יש כבר את אותם
-- התפקידים ב-app_metadata. אם נותר מישהו כזה, המיגרציה נכשלת ומציגה את
-- המזהים, ולא מוחקת כלום. שתי סיבות אפשריות, ויש להכריע ידנית:
--   א. תפקיד לגיטימי שהקוד הישן כתב בין המיגרציה הראשונה לעליית הקוד (אישור
--      שדכן/איש צוות או עריכת תפקידים בזמן ה-deploy) - להעתיק ל-app_metadata
--      ידנית דרך Admin API / SQL ואז להריץ שוב.
--   ב. ניסיון הזרקה של תוקף (updateUser({ data: { roles: ["admin"] } })) -
--      לא לקדם! פשוט להמשיך: המחיקה למטה מנקה אותו.
-- חשוב: לא להריץ שוב את ה-backfill של המיגרציה הראשונה בשלב הזה - הוא היה
-- מקדם גם ניסיונות הזרקה.
--
-- אידמפוטנטית.
-- ════════════════════════════════════════════════════════════════════════

DO $do$
DECLARE
  v_missing integer;
  v_ids text;
BEGIN
  SELECT count(*), string_agg(u.id::text, ', ') INTO v_missing, v_ids
  FROM auth.users u
  WHERE EXISTS (
    SELECT 1
    FROM unnest(ARRAY['admin', 'shadchan', 'staff']) AS r(role)
    WHERE ((jsonb_typeof(u.raw_user_meta_data->'roles') = 'array'
            AND u.raw_user_meta_data->'roles' ? r.role)
        OR (jsonb_typeof(u.raw_user_meta_data->'role') = 'string'
            AND u.raw_user_meta_data->>'role' = r.role))
      AND NOT (jsonb_typeof(u.raw_app_meta_data->'roles') = 'array'
               AND u.raw_app_meta_data->'roles' ? r.role)
  );

  IF v_missing > 0 THEN
    RAISE EXCEPTION
      'strip_user_metadata_roles: % users have roles in user_metadata that are missing from app_metadata (ids: %). Review each one: copy legitimate roles to app_metadata manually, then re-run. Do NOT re-run the backfill blindly.',
      v_missing, v_ids;
  END IF;
END
$do$;

UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data - 'roles' - 'role'
WHERE raw_user_meta_data ?| ARRAY['roles', 'role'];
