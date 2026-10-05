# מעבר תפקידים ל-app_metadata: ריצה בפרודקשן

התפקידים (admin / shadchan / staff) עברו מ-`user_metadata` (שהמשתמש עצמו יכול לכתוב) ל-`app_metadata.roles` (service role בלבד). המסמך מתאר איך מריצים את המעבר בפרודקשן בלי להעניק תפקיד למי שלא אמור לקבל, ובלי להפיל את המנהלים.

המיגרציות הרלוונטיות: `20261007090000_security_hardening.sql`, `20261007100000_roles_to_app_metadata.sql`, `20261007110000_security_hardening_2.sql`. הסקריפט הידני: `supabase/post-deploy/20261007100100_strip_user_metadata_roles.sql`.

## 1. ביקורת לפני המיגרציה (חובה)

ה-backfill מעתיק לכל משתמש את התפקידים שכתוב ב-`user_metadata`. מי שכבר ניצל את הפרצה (`updateUser({ data: { roles: ["admin"] } })`) יקודם באמת. לכן מריצים בפרודקשן, לקריאה בלבד, את השאילתה הבאה ובודקים אותה לפני הכול:

```sql
SELECT
  u.id,
  u.email,
  u.created_at,
  u.last_sign_in_at,
  u.raw_user_meta_data->'roles' AS user_meta_roles,
  u.raw_user_meta_data->'role'  AS user_meta_role,
  u.raw_app_meta_data->'roles'  AS app_meta_roles,
  sh.application_status         AS shadchan_status,
  sh.approved_at                AS shadchan_approved_at,
  st.application_status         AS staff_status,
  st.approved_at                AS staff_approved_at
FROM auth.users u
LEFT JOIN public.shadchanim_info sh ON sh.user_id = u.id
LEFT JOIN public.staff_info st      ON st.user_id = u.id
WHERE u.raw_user_meta_data ?| ARRAY['roles', 'role']
ORDER BY u.created_at;
```

איך קוראים את התוצאה:

- מנהל מוכר: אימייל מוכר ו-`app_meta_roles` כבר מכיל `admin`. תקין.
- שדכן / איש צוות מוכר: `user_meta_roles` כולל `shadchan` / `staff` ויש שורה מאושרת מתאימה (`shadchan_status` / `staff_status` = `approved` עם `approved_at`). תקין.
- חריג: מחזיק `admin` בלי שאתם מכירים אותו, או `shadchan` / `staff` בלי שורה מאושרת, או חשבון חדש שנכנס רק לאחרונה. אלה המועמדים לניצול הפרצה.

מה עושים עם שורה חריגה: **לפני המיגרציה** מסירים את התפקיד מה-`user_metadata` של אותו משתמש, כדי שה-backfill לא יעתיק אותו:

```sql
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data - 'roles' - 'role'
WHERE id = '<USER_ID>';
```

(אם צריך לשמור תפקיד לגיטימי אחד של אותו משתמש, מורידים רק את החריג ולא את כל המפתח.) מומלץ גם לבדוק מה המשתמש עשה בזמן שהחזיק את התפקיד.

## 2. הרצת המיגרציות ופריסת הקוד: ביחד

1. מריצים את המיגרציות (`supabase db push` או הנתיב הרגיל שלכם) **מיד לפני** שהקוד החדש עולה. ה-backfill מדפיס `RAISE NOTICE` לכל משתמש שמקבל תפקיד חדש (מזהה, אימייל, תפקידים) ושורת סיכום. שומרים את הפלט ומשווים אותו לרשימה שנבדקה בשלב 1.
2. פורסים את הקוד החדש מיד אחרי.

למה בסדר הזה:

- **לא קוד לפני מיגרציה:** הקוד החדש קורא רק את `app_metadata`. לפני ה-backfill כולם נראים בו חסרי תפקיד, והמנהלים נעולים בחוץ.
- **לא להשאיר את הקוד הישן רץ זמן רב אחרי המיגרציה:** הקוד הישן עדיין סומך על `user_metadata`, ולכן ברמת האפליקציה הפרצה נשארת פתוחה (מסד הנתונים כבר לא סומך עליו) עד שהקוד החדש חי. שומרים על חלון קצר ככל האפשר.

## 3. בדיקות עשן אחרי הפריסה

- מנהל נכנס: רואה את לוח הניהול ואת רשימת המשתמשים.
- שדכן נכנס: רואה את ההצעות שלו ויכול לשמור טיוטה.
- משתמש רגיל (חשבון בדיקה בלי תפקידים) מריץ בקונסולה `supabase.auth.updateUser({ data: { roles: ["admin"] } })` ואז נכנס ל-`/app/admin`: מקבל דחייה.
- משתמש רגיל כותב שורה ל-`staff_info` עם `application_status: "approved"`: השורה נשמרת כ-`pending`.
- בקשת הצטרפות חדשה כשדכן / איש צוות עדיין נשלחת ומופיעה למנהל.

## 4. התאמה: תפקידים שהקוד הישן העניק או שלל בזמן החלון

בין המיגרציה לעליית הקוד, הקוד הישן ממשיך לכתוב תפקידים (אישור שדכן / איש צוות, עריכת תפקידים) ל-`user_metadata` בלבד. מריצים אחרי שהקוד החדש עלה:

```sql
SELECT
  u.id,
  u.email,
  u.raw_user_meta_data->'roles' AS user_meta_roles,
  u.raw_user_meta_data->'role'  AS user_meta_role,
  u.raw_app_meta_data->'roles'  AS app_meta_roles
FROM auth.users u
WHERE u.raw_user_meta_data ?| ARRAY['roles', 'role']
  AND (
    EXISTS (
      SELECT 1 FROM unnest(ARRAY['admin', 'shadchan', 'staff']) AS r(role)
      WHERE ((jsonb_typeof(u.raw_user_meta_data->'roles') = 'array' AND u.raw_user_meta_data->'roles' ? r.role)
          OR (jsonb_typeof(u.raw_user_meta_data->'role') = 'string' AND u.raw_user_meta_data->>'role' = r.role))
        AND NOT (jsonb_typeof(u.raw_app_meta_data->'roles') = 'array' AND u.raw_app_meta_data->'roles' ? r.role)
    )
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(
        CASE WHEN jsonb_typeof(u.raw_app_meta_data->'roles') = 'array'
             THEN u.raw_app_meta_data->'roles' ELSE '[]'::jsonb END) AS a(role)
      WHERE NOT (jsonb_typeof(u.raw_user_meta_data->'roles') = 'array' AND u.raw_user_meta_data->'roles' ? a.role)
        AND NOT (jsonb_typeof(u.raw_user_meta_data->'role') = 'string' AND u.raw_user_meta_data->>'role' = a.role)
    )
  );
```

- תפקיד שיש ב-`user_metadata` ואין ב-`app_metadata` = הוענק בחלון (או ניסיון הזרקה). מעניקים ל-`app_metadata` ידנית רק אם הוא לגיטימי (אישור מנהל אמיתי), דרך Admin API או `UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data || '{"roles": [...]}'`.
- תפקיד שיש ב-`app_metadata` ואין ב-`user_metadata` = נשלל בחלון על ידי הקוד הישן. מסירים אותו מ-`app_metadata` אם השלילה לגיטימית.
- אל תריצו שוב את ה-backfill של המיגרציה הראשונה בשלב הזה: הוא היה מקדם גם ניסיונות הזרקה.

## 5. ניקוי user_metadata: רק אחרי שהקוד החדש יציב

`supabase/post-deploy/20261007100100_strip_user_metadata_roles.sql` מוחק את `roles` / `role` מ-`user_metadata`. מריצים אותו **ידנית**, רק אחרי שהקוד החדש חי, יציב, ושלב 4 נסגר. לא לפני, ולא כחלק מה-deploy: הקוד הישן קורא משם, ומחיקה מוקדמת הופכת את כל המנהלים והשדכנים למשתמשים רגילים.

הסקריפט נכשל בלי למחוק כלום אם נשאר מישהו עם תפקיד ב-`user_metadata` שחסר ב-`app_metadata`, ומציג את המזהים.
