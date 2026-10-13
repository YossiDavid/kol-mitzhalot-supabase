-- סוגי התראה חדשים:
--  * application_message - הודעה חופשית מהמנהל למבקש/ת הצטרפות (שדכן / איש צוות)
--  * card_report         - דיווח על כרטיס, לכל המנהלים
-- מרחיב את notifications_type_check באותה שיטה כמו 20261013090000_third_party_cards.sql
-- (מוחק ויוצר מחדש, עם הרשימה הקיימת + שני הסוגים). אידמפוטנטית.
-- להחלה: psql -v ON_ERROR_STOP=1 -f <file>

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check CHECK (type = ANY (ARRAY[
    'shidduch_offer'::text,
    'shidduch_response'::text,
    'application_reviewed'::text,
    'application_submitted'::text,
    'chat_message'::text,
    'photo_request_submitted'::text,
    'photo_request_reviewed'::text,
    'user_registered'::text,
    'shidduch_closed_notice'::text,
    'third_party_card_created'::text,
    'third_party_card_approved'::text,
    'application_message'::text,
    'card_report'::text
  ]));

-- ── Rollback (להריץ ידנית; קודם למחוק שורות מהסוגים החדשים) ──
-- DELETE FROM public.notifications WHERE type IN ('application_message', 'card_report');
-- ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
-- ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type = ANY (ARRAY[
--   'shidduch_offer','shidduch_response','application_reviewed','application_submitted','chat_message',
--   'photo_request_submitted','photo_request_reviewed','user_registered','shidduch_closed_notice',
--   'third_party_card_created','third_party_card_approved']));
