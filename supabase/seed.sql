-- Local-only fictional seed. Never push this data to cloud.
-- Default password for all seeded users: password123

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

SET search_path TO public, extensions, auth;

-- ---------------------------------------------------------------------------
-- Auth users (roles live in raw_user_meta_data.role — matches is_admin/is_shadchan)
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-1111-1111-111111111111',
    'authenticated',
    'authenticated',
    'admin@local.test',
    extensions.crypt('password123', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"admin","firstName":"אבי","lastName":"מנהל"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222222',
    'authenticated',
    'authenticated',
    'shadchan@local.test',
    extensions.crypt('password123', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"shadchan","firstName":"שרה","lastName":"שדכנית"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '33333333-3333-3333-3333-333333333333',
    'authenticated',
    'authenticated',
    'parent-groom@local.test',
    extensions.crypt('password123', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"user","firstName":"יוסף","lastName":"כהן"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '44444444-4444-4444-4444-444444444444',
    'authenticated',
    'authenticated',
    'parent-bride@local.test',
    extensions.crypt('password123', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"user","firstName":"רחל","lastName":"לוי"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT
  id,
  id,
  jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
  'email',
  id::text,
  now(),
  now(),
  now()
FROM auth.users
WHERE email LIKE '%@local.test';

-- ---------------------------------------------------------------------------
-- Shadchan profile
-- ---------------------------------------------------------------------------
INSERT INTO public.shadchanim_info (
  user_id,
  bio,
  experience_years,
  specializations,
  contact_phone,
  contact_email,
  location,
  languages,
  application_status,
  submitted_at,
  approved_at
) VALUES (
  '22222222-2222-2222-2222-222222222222',
  'שדכנית מנוסה מהמגזר החרדי — נתונים פיקטיביים לפיתוח מקומי.',
  8,
  ARRAY['בני ישיבות', 'סמינרים', 'חוזרים בתשובה'],
  '050-1112233',
  'shadchan@local.test',
  'ירושלים',
  ARRAY['עברית', 'אנגלית'],
  'approved',
  now() - interval '30 days',
  now() - interval '25 days'
);

-- ---------------------------------------------------------------------------
-- Students (fictional cards)
-- ---------------------------------------------------------------------------
INSERT INTO public.students (
  id,
  user_id,
  first_name,
  last_name,
  identity_number,
  birth_date,
  gender,
  personal_status,
  height,
  phone,
  country,
  city,
  street,
  community,
  cellphone_type,
  plan_for_life,
  about,
  in_shidduchim,
  parents_info,
  family_info
) VALUES
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '33333333-3333-3333-3333-333333333333',
    'דוד',
    'כהן',
    '300000001',
    '1998-03-12',
    'male',
    'single',
    178,
    '050-3000001',
    'ישראל',
    'בני ברק',
    'רחוב האלון',
    'ליטאי',
    'kosher',
    'koilel',
    'בחור רציני, אוהב ללמוד. (פיקטיבי)',
    true,
    '{"father":{"self":{"prefix":"ר׳","name":"יוסף","suffix":""},"job":"מלמד"},"mother":{"self":{"prefix":"מרת","name":"מרים","suffix":""}}}'::jsonb,
    '{"siblings_count":5}'::jsonb
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '33333333-3333-3333-3333-333333333333',
    'משה',
    'כהן',
    '300000002',
    '2000-07-21',
    'male',
    'single',
    175,
    '050-3000002',
    'ישראל',
    'מודיעין עילית',
    'רחוב הדקל',
    'חסידי',
    'sms',
    'mix_torah_work',
    'בחור נעים הליכות. (פיקטיבי)',
    true,
    '{"father":{"self":{"prefix":"ר׳","name":"יוסף","suffix":""}},"mother":{"self":{"prefix":"מרת","name":"מרים","suffix":""}}}'::jsonb,
    '{"siblings_count":5}'::jsonb
  ),
  (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '44444444-4444-4444-4444-444444444444',
    'חנה',
    'לוי',
    '400000001',
    '1999-11-05',
    'female',
    'single',
    165,
    '050-4000001',
    'ישראל',
    'ירושלים',
    'רחוב הכרמל',
    'ספרדי',
    'protected_smartphone',
    'torah_job',
    'בחורה משכילה ושקטה. (פיקטיבי)',
    true,
    '{"father":{"self":{"prefix":"ר׳","name":"אברהם","suffix":""},"job":"סוחר"},"mother":{"self":{"prefix":"מרת","name":"רחל","suffix":""}}}'::jsonb,
    '{"siblings_count":4}'::jsonb
  ),
  (
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    '44444444-4444-4444-4444-444444444444',
    'רבקה',
    'לוי',
    '400000002',
    '2001-01-18',
    'female',
    'single',
    162,
    '050-4000002',
    'ישראל',
    'בית שמש',
    'רחוב הזית',
    'ליטאי',
    'kosher',
    'work',
    'בחורה חברותית. (פיקטיבי)',
    true,
    '{"father":{"self":{"prefix":"ר׳","name":"אברהם","suffix":""}},"mother":{"self":{"prefix":"מרת","name":"רחל","suffix":""}}}'::jsonb,
    '{"siblings_count":4}'::jsonb
  );

INSERT INTO public.partner_preferences (student_id, age_min, age_max, preferred_countries, plan_for_life, about_partner)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 20, 26, ARRAY['ישראל'], 'torah_job', 'מחפש בת תורה רצינית'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 19, 24, ARRAY['ישראל'], 'mix_torah_work', 'מחפש בת טובת לב'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 22, 28, ARRAY['ישראל'], 'koilel', 'מחפשת בן תורה'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 21, 27, ARRAY['ישראל'], 'work', 'מחפשת בחור יציב');

INSERT INTO public.medical_records (student_id, status, exposure_level, details)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'good', 'no_exposure', null),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'good', 'no_exposure', null),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'good', 'basic_exposure', 'אלרגיה קלה (פיקטיבי)'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'good', 'no_exposure', null);

INSERT INTO public.education_history (student_id, institution_type, name, community, city)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'yeshiva_gdola', 'ישיבת פיקטיבית א', 'ליטאי', 'בני ברק'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'yeshiva_ktana', 'ישיבת פיקטיבית ב', 'חסידי', 'מודיעין עילית'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'seminar', 'סמינר פיקטיבי', 'ספרדי', 'ירושלים'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'seminar', 'סמינר פיקטיבי ב', 'ליטאי', 'בית שמש');

INSERT INTO public.references (student_id, reference_type, name, phone)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'rabbi', 'הרב פיקטיבי', '02-5550001'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'friend', 'חברה פיקטיבית', '050-5550002');

-- ---------------------------------------------------------------------------
-- Sample shidduch (draft)
-- ---------------------------------------------------------------------------
INSERT INTO public.shidduchim (
  id,
  groom_id,
  bride_id,
  shadchan_id,
  status,
  note_for_groom,
  note_for_bride,
  recipient_scope
) VALUES (
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  '22222222-2222-2222-2222-222222222222',
  'draft',
  'הצעה לבדיקה מקומית — צד החתן',
  'הצעה לבדיקה מקומית — צד הכלה',
  'both'
);

-- ---------------------------------------------------------------------------
-- Forum
-- ---------------------------------------------------------------------------
INSERT INTO public.forum_categories (id, name, description, slug, icon, sort_order)
VALUES
  ('f1000000-0000-0000-0000-000000000001', 'כללי', 'דיונים כלליים', 'general', 'message-circle', 1),
  ('f1000000-0000-0000-0000-000000000002', 'טיפים לשדכנים', 'שיתוף ניסיון', 'tips', 'lightbulb', 2),
  ('f1000000-0000-0000-0000-000000000003', 'שאלות הלכתיות', 'שאלות לרבנים', 'halacha', 'book', 3),
  ('f1000000-0000-0000-0000-000000000004', 'הצלחות', 'סיפורי שידוכים', 'success', 'heart', 4);

INSERT INTO public.forum_posts (id, title, content, author_id, category_id, is_pinned, tags)
VALUES
  (
    'f2000000-0000-0000-0000-000000000001',
    'ברוכים הבאים לפורום המקומי',
    'זוהי פוסט פיקטיבי לסביבת פיתוח. אפשר למחוק ולנסות.',
    '22222222-2222-2222-2222-222222222222',
    'f1000000-0000-0000-0000-000000000001',
    true,
    ARRAY['welcome', 'local']
  ),
  (
    'f2000000-0000-0000-0000-000000000002',
    'איך פותחים שיחה ראשונה?',
    'אשמח לטיפים מהשטח (תוכן פיקטיבי).',
    '22222222-2222-2222-2222-222222222222',
    'f1000000-0000-0000-0000-000000000002',
    false,
    ARRAY['tips']
  );

INSERT INTO public.forum_replies (post_id, content, author_id)
VALUES (
  'f2000000-0000-0000-0000-000000000002',
  'תשובה פיקטיבית לדוגמה.',
  '11111111-1111-1111-1111-111111111111'
);

-- ---------------------------------------------------------------------------
-- System content & settings
-- ---------------------------------------------------------------------------
INSERT INTO public.system_content (key, title, content)
VALUES
  (
    'privacy_policy',
    'מדיניות פרטיות (מקומי)',
    '<p>מדיניות פרטיות פיקטיבית לסביבת פיתוח בלבד.</p>'
  ),
  (
    'terms_of_service',
    'תנאי שימוש (מקומי)',
    '<p>תנאי שימוש פיקטיביים לסביבת פיתוח בלבד.</p>'
  ),
  (
    'about',
    'אודות (מקומי)',
    '<p>קול מצהלות — סביבת פיתוח מקומית עם נתוני seed.</p>'
  );

INSERT INTO public.system_settings (key, value)
VALUES ('phone_verification_enabled', false)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
