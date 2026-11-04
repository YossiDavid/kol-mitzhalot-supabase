-- ממצאים נמוכים מסקירת האבטחה (23, 24, 30).
-- (ממצא 19 בוטל: לימודים ותעסוקה הם חלק מהכרטיס הבסיסי, וגלויים לשדכן גם
--  בכרטיס צד שלישי מוגבל - ראו BASIC_STUDENT_EMBEDS.)
--
-- 23/24. פונקציות שחושפות הרשאה / תפקיד של משתמש לפי uuid היו פתוחות ל-anon.
--     אף מדיניות שחלה על anon ואף פונקציה שאינה SECURITY DEFINER לא קוראת להן
--     (נבדק בפרודקשן), ולכן אפשר לסגור. is_admin(uuid) נשאר: מדיניות ציבורית
--     קוראת ל-is_admin().
-- 30. search_path קבוע לשתי פונקציות SECURITY DEFINER שהיו בלעדיו.
--
-- ROLLBACK:
--   GRANT EXECUTE ON FUNCTION public.has_role(uuid, text), public.is_approved_shadchan(uuid),
--     public.can_view_student_photo(uuid, uuid) TO anon;
--   ALTER FUNCTION public.is_admin(uuid) RESET search_path;
--   ALTER FUNCTION public.chat_rooms_set_last_message() RESET search_path;

-- ── 23 / 24 ──
REVOKE ALL ON FUNCTION public.has_role(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_approved_shadchan(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_view_student_photo(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_approved_shadchan(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_student_photo(uuid, uuid) TO authenticated, service_role;

-- ── 30 ──
ALTER FUNCTION public.is_admin(uuid) SET search_path = public, auth;
ALTER FUNCTION public.chat_rooms_set_last_message() SET search_path = public;
