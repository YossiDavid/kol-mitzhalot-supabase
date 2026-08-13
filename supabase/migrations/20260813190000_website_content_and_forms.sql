-- Website content tables, public forms, newsletter, content storage, legal seed
-- Importers/callers: website contact/newsletter actions, admin content pages, legal pages, endorsements carousel
-- API: PostgREST tables articles, engagements, endorsements, contact_submissions, newsletter_subscribers + storage bucket content
-- Schema: see CREATE TABLE blocks below
-- User instruction: "1. להוסיף אזורים במערכת הניהול... 3. לחבר את הטפסים... 6. לחבר אותו לטבלה ב db... 7. עמודים משפטיים - תוסיף תוכן פיקטיבי."

CREATE TABLE IF NOT EXISTS public.articles (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  slug                text NOT NULL UNIQUE,
  title               text NOT NULL,
  excerpt             text NOT NULL,
  content             text NOT NULL,
  category            text NOT NULL CHECK (category IN ('parents','singles','shadchanim','general')),
  cover_image_url     text,
  read_time_minutes   integer DEFAULT 5,
  author_id           uuid REFERENCES auth.users(id),
  is_published        boolean DEFAULT false,
  published_at        timestamptz,
  created_at          timestamptz DEFAULT now()
);

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "articles_public_select" ON public.articles;
CREATE POLICY "articles_public_select" ON public.articles
  FOR SELECT TO anon, authenticated
  USING (is_published = true);

DROP POLICY IF EXISTS "articles_admin_all" ON public.articles;
CREATE POLICY "articles_admin_all" ON public.articles
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT ON TABLE public.articles TO anon, authenticated;
GRANT ALL ON TABLE public.articles TO service_role;
GRANT INSERT, UPDATE, DELETE ON TABLE public.articles TO authenticated;

CREATE TABLE IF NOT EXISTS public.engagements (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  groom_name          text NOT NULL,
  groom_father        text,
  groom_city          text,
  groom_yeshiva       text,
  bride_name          text NOT NULL,
  bride_father        text,
  bride_city          text,
  bride_seminary      text,
  shadchan_name       text,
  closed_at           timestamptz,
  submitter_name      text,
  submitter_phone     text,
  submitter_email     text,
  is_published        boolean DEFAULT false,
  created_at          timestamptz DEFAULT now()
);

ALTER TABLE public.engagements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "engagements_public_select" ON public.engagements;
CREATE POLICY "engagements_public_select" ON public.engagements
  FOR SELECT TO anon, authenticated
  USING (is_published = true);

DROP POLICY IF EXISTS "engagements_public_insert" ON public.engagements;
CREATE POLICY "engagements_public_insert" ON public.engagements
  FOR INSERT TO anon, authenticated
  WITH CHECK (is_published = false);

DROP POLICY IF EXISTS "engagements_admin_all" ON public.engagements;
CREATE POLICY "engagements_admin_all" ON public.engagements
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT, INSERT ON TABLE public.engagements TO anon, authenticated;
GRANT ALL ON TABLE public.engagements TO service_role;
GRANT UPDATE, DELETE ON TABLE public.engagements TO authenticated;

CREATE TABLE IF NOT EXISTS public.endorsements (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  rav_name            text NOT NULL,
  rav_title           text,
  image_url           text,
  endorsement_text    text,
  sort_order          integer DEFAULT 0,
  is_published        boolean DEFAULT true,
  created_at          timestamptz DEFAULT now()
);

ALTER TABLE public.endorsements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "endorsements_public_select" ON public.endorsements;
CREATE POLICY "endorsements_public_select" ON public.endorsements
  FOR SELECT TO anon, authenticated
  USING (is_published = true);

DROP POLICY IF EXISTS "endorsements_admin_all" ON public.endorsements;
CREATE POLICY "endorsements_admin_all" ON public.endorsements
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT ON TABLE public.endorsements TO anon, authenticated;
GRANT ALL ON TABLE public.endorsements TO service_role;
GRANT INSERT, UPDATE, DELETE ON TABLE public.endorsements TO authenticated;

CREATE TABLE IF NOT EXISTS public.contact_submissions (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type          text NOT NULL CHECK (type IN ('contact', 'shidduch_idea')),
  name          text NOT NULL,
  email         text NOT NULL,
  phone         text,
  subject       text,
  message       text,
  payload       jsonb DEFAULT '{}'::jsonb NOT NULL,
  status        text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'archived')),
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contact_submissions_type_created_idx
  ON public.contact_submissions (type, created_at DESC);
CREATE INDEX IF NOT EXISTS contact_submissions_status_idx
  ON public.contact_submissions (status);

ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contact_submissions_public_insert" ON public.contact_submissions;
CREATE POLICY "contact_submissions_public_insert" ON public.contact_submissions
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    type IN ('contact', 'shidduch_idea')
    AND status = 'new'
  );

DROP POLICY IF EXISTS "contact_submissions_admin_all" ON public.contact_submissions;
CREATE POLICY "contact_submissions_admin_all" ON public.contact_submissions
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT INSERT ON TABLE public.contact_submissions TO anon, authenticated;
GRANT ALL ON TABLE public.contact_submissions TO service_role;
GRANT SELECT, UPDATE, DELETE ON TABLE public.contact_submissions TO authenticated;

CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email         text NOT NULL,
  source        text NOT NULL DEFAULT 'footer',
  created_at    timestamptz DEFAULT now(),
  CONSTRAINT newsletter_subscribers_email_key UNIQUE (email)
);

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "newsletter_subscribers_public_insert" ON public.newsletter_subscribers;
CREATE POLICY "newsletter_subscribers_public_insert" ON public.newsletter_subscribers
  FOR INSERT TO anon, authenticated
  WITH CHECK (email ~* '^[^@]+@[^@]+\.[^@]+$');

DROP POLICY IF EXISTS "newsletter_subscribers_admin_all" ON public.newsletter_subscribers;
CREATE POLICY "newsletter_subscribers_admin_all" ON public.newsletter_subscribers
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT INSERT ON TABLE public.newsletter_subscribers TO anon, authenticated;
GRANT ALL ON TABLE public.newsletter_subscribers TO service_role;
GRANT SELECT, UPDATE, DELETE ON TABLE public.newsletter_subscribers TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'content',
  'content',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "content_images_public_read" ON storage.objects;
CREATE POLICY "content_images_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'content');

DROP POLICY IF EXISTS "content_images_admin_insert" ON storage.objects;
CREATE POLICY "content_images_admin_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'content' AND public.is_admin());

DROP POLICY IF EXISTS "content_images_admin_update" ON storage.objects;
CREATE POLICY "content_images_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'content' AND public.is_admin())
  WITH CHECK (bucket_id = 'content' AND public.is_admin());

DROP POLICY IF EXISTS "content_images_admin_delete" ON storage.objects;
CREATE POLICY "content_images_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'content' AND public.is_admin());

UPDATE public.system_content
SET
  title = 'תנאי שימוש',
  content = $html$
<p><strong>גרסת טיוטה לדוגמה — אינה מסמך משפטי מחייב.</strong></p>
<p>ברוכים הבאים לאתר ולמערכת «קול מצהלות». השימוש באתר ובשירותים כפוף לתנאים אלה. המשך שימוש מהווה הסכמה לתנאים.</p>
<h2>1. כללי</h2>
<p>השירות מיועד לקידום שידוכים בקהילה, בכפוף לפיקוח רבני ולמדיניות הפרטיות. אין לראות בתוכן האתר ייעוץ הלכתי, משפטי או רפואי.</p>
<h2>2. חשבון משתמש</h2>
<p>המשתמש אחראי לשמירת פרטי הגישה שלו ולדיוק המידע שהוא מוסר. מסירת מידע כוזב עלולה להביא להשעיית החשבון.</p>
<h2>3. שימוש מותר</h2>
<p>אין להשתמש בשירות לשידול, הטרדה, פרסום מסחרי לא מורשה, או כל פעולה הפוגעת בצדדים שלישיים או בקהילה.</p>
<h2>4. הגבלת אחריות</h2>
<p>השירות ניתן «כפי שהוא». איננו מתחייבים להתאמה מושלמת בין הצעות או לתוצאה מסוימת בתהליך השידוך.</p>
<h2>5. יצירת קשר</h2>
<p>לשאלות בנוגע לתנאים ניתן לפנות דרך עמוד «צרו קשר» באתר.</p>
$html$,
  updated_at = now()
WHERE key = 'terms-of-service';

UPDATE public.system_content
SET
  title = 'מדיניות פרטיות',
  content = $html$
<p><strong>גרסת טיוטה לדוגמה — אינה מדיניות פרטיות סופית.</strong></p>
<p>מדיניות זו מתארת באופן כללי כיצד אנו אוספים ומשתמשים במידע אישי במסגרת האתר והמערכת.</p>
<h2>1. איזה מידע נאסף</h2>
<p>מידע שנמסר בטפסים (שם, טלפון, דוא״ל), פרטי חשבון, ומידע טכני בסיסי כגון כתובת IP וסוג דפדפן — ככל שנדרש להפעלת השירות.</p>
<h2>2. מטרות השימוש</h2>
<p>לטיפול בפניות, ניהול חשבונות, שיפור השירות, שליחת עדכונים למי שנרשם לרשימת תפוצה, ועמידה בדרישות דין.</p>
<h2>3. שיתוף עם צדדים שלישיים</h2>
<p>לא נמכור מידע אישי. ייתכן שיתוף עם ספקי תשתית (אחסון, דוא״ל) לצורך מתן השירות בלבד.</p>
<h2>4. אבטחה ושמירה</h2>
<p>אנו נוקטים באמצעים סבירים להגנה על המידע. משך השמירה תלוי בסוג המידע ובצורך התפעולי.</p>
<h2>5. זכויות</h2>
<p>ניתן לפנות אלינו בבקשה לעיון, תיקון או מחיקה של מידע, בכפוף למגבלות חוקיות ותפעוליות.</p>
$html$,
  updated_at = now()
WHERE key = 'privacy-policy';

UPDATE public.system_content
SET
  title = 'הצהרת נגישות',
  content = $html$
<p><strong>גרסת טיוטה לדוגמה — תעודכן בהתאם לביקורת נגישות בפועל.</strong></p>
<p>אנו שואפים להנגיש את האתר והמערכת לכלל הציבור, כולל אנשים עם מוגבלויות, בהתאם לעקרונות הנגישות המקובלים.</p>
<h2>1. התאמות קיימות</h2>
<ul>
<li>תמיכה בניווט מקלדת בסיסי</li>
<li>ניגודיות צבעים משופרת באזורים מרכזיים</li>
<li>מבנה כותרות ותוויות לטפסים</li>
</ul>
<h2>2. מגבלות ידועות</h2>
<p>חלק מהמסכים והרכיבים עדיין בתהליך שיפור נגישות. נשמח לקבל דיווחים על חסמים.</p>
<h2>3. יצירת קשר בנושא נגישות</h2>
<p>לדיווח על בעיית נגישות או בקשה להתאמה — פנו דרך עמוד «צרו קשר» וציינו «נגישות» בנושא הפנייה.</p>
$html$,
  updated_at = now()
WHERE key = 'accessibility';
