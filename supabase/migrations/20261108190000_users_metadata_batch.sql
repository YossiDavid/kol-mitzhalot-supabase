-- שמות הצד השני בכל השיחות בקריאה אחת (עומס על המסד).
--
-- רשימת השיחות קראה ל-get_user_metadata פעם לכל שיחה: בפרודקשן 165 אלף
-- קריאות, כ-10ms כל אחת - הפונקציה היקרה ביותר באפליקציה. get_users_metadata
-- מחזירה את אותו מידע לכמה משתמשים בשאילתה אחת, באותו כלל הרשאה בדיוק:
-- הצופה עצמו, שדכן/מנהל, או משתמש שיש איתו שיחה משותפת. אימייל - רק לעצמו
-- ולמנהל. משתמש שאינו מותר פשוט אינו חוזר (כמו NULL ב-get_user_metadata).
--
-- ROLLBACK: DROP FUNCTION public.get_users_metadata(uuid[]);

CREATE OR REPLACE FUNCTION public.get_users_metadata(target_user_ids uuid[])
RETURNS TABLE(user_id uuid, metadata jsonb)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  WITH me AS (
    SELECT auth.uid() AS uid,
           COALESCE(public.is_shadchan_or_admin(), false) AS is_staff,
           COALESCE(public.is_admin(), false) AS is_admin
  ),
  -- תקרה: רשימת שיחות סבירה; מונעת מערך ענק בבקשה אחת
  targets AS (
    SELECT DISTINCT t.id
      FROM unnest(target_user_ids[1:500]) AS t(id)
     WHERE t.id IS NOT NULL
  ),
  allowed AS (
    SELECT t.id
      FROM targets t, me
     WHERE me.uid IS NOT NULL
       AND (
         t.id = me.uid
         OR me.is_staff
         OR EXISTS (
           SELECT 1
             FROM public.chat_room_participants crp1
             JOIN public.chat_room_participants crp2 ON crp1.room_id = crp2.room_id
            WHERE crp1.user_id = me.uid
              AND crp2.user_id = t.id
              AND crp1.deleted_before IS NULL
              AND crp2.deleted_before IS NULL
         )
       )
  )
  SELECT u.id,
         jsonb_build_object(
           'id', u.id,
           'firstName', COALESCE(
             NULLIF(TRIM(p.first_name), ''),
             NULLIF(TRIM(u.raw_user_meta_data->>'firstName'), ''),
             NULLIF(TRIM(u.raw_user_meta_data->>'first_name'), '')
           ),
           'lastName', COALESCE(
             NULLIF(TRIM(p.last_name), ''),
             NULLIF(TRIM(u.raw_user_meta_data->>'lastName'), ''),
             NULLIF(TRIM(u.raw_user_meta_data->>'last_name'), '')
           ),
           'email', CASE WHEN u.id = me.uid OR me.is_admin
                         THEN COALESCE(p.email, u.email) END
         )
    FROM allowed a
    JOIN auth.users u ON u.id = a.id
    LEFT JOIN public.user_profiles p ON p.id = u.id
    CROSS JOIN me;
$$;

ALTER FUNCTION public.get_users_metadata(uuid[]) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_users_metadata(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_users_metadata(uuid[]) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
