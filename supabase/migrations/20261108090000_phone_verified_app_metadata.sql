-- אימות טלפון עובר מ-user_metadata.phone_verified (שהמשתמש כותב בעצמו דרך
-- supabase.auth.updateUser) ל-app_metadata.verified_phone (נכתב רק בשרת,
-- ב-service role, אחרי OTP תקין). ראו lib/phone-verification.ts.
--
-- backfill: מי שסומן מאומת עד היום מקבל verified_phone = המספר הנוכחי שלו,
-- כדי שלא יידרש לאמת מחדש. אין דרך להבחין בדיעבד בין סימון אמיתי למזויף.
--
-- ROLLBACK: אין צורך - הקוד הישן לא קורא את המפתח, והמפתח לא מזיק.
UPDATE auth.users
   SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
         || jsonb_build_object(
              'verified_phone', COALESCE(NULLIF(trim(raw_user_meta_data->>'phone'), ''), phone),
              'phone_verified_at', COALESCE(raw_user_meta_data->>'phone_confirmed_at', now()::text)
            )
 WHERE raw_user_meta_data->>'phone_verified' = 'true'
   AND COALESCE(NULLIF(trim(raw_user_meta_data->>'phone'), ''), phone) IS NOT NULL
   AND NOT (COALESCE(raw_app_meta_data, '{}'::jsonb) ? 'verified_phone');
