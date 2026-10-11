-- אינדקסים לפורום השדכנים, כדי שהדפדוף (20 פוסטים בעמוד) ושליפת התגובות
-- יישארו מהירים כשהפורום יגדל. תוספתי בלבד: אין שינוי בנתונים, בהרשאות או
-- באינדקסים קיימים. אפשר להריץ שוב (IF NOT EXISTS).

-- רשימת הפוסטים: נעוצים קודם, ואז מהחדש לישן, עם id כשובר שוויון
CREATE INDEX IF NOT EXISTS forum_posts_list_order_idx
  ON public.forum_posts (is_pinned DESC, created_at DESC, id DESC);

-- אותה רשימה כשמסננים לפי קטגוריה
CREATE INDEX IF NOT EXISTS forum_posts_category_list_order_idx
  ON public.forum_posts (category_id, is_pinned DESC, created_at DESC, id DESC);

-- תגובות של פוסט לפי סדר כתיבה, וספירת תגובות לכל פוסט ברשימה
CREATE INDEX IF NOT EXISTS forum_replies_post_order_idx
  ON public.forum_replies (post_id, created_at, id);

-- לייקים לפי פוסט / תגובה (המפתחות הייחודיים הקיימים מתחילים ב-user_id)
CREATE INDEX IF NOT EXISTS forum_likes_post_id_idx
  ON public.forum_likes (post_id);
CREATE INDEX IF NOT EXISTS forum_likes_reply_id_idx
  ON public.forum_likes (reply_id);

-- ביטול:
--   DROP INDEX IF EXISTS public.forum_posts_list_order_idx;
--   DROP INDEX IF EXISTS public.forum_posts_category_list_order_idx;
--   DROP INDEX IF EXISTS public.forum_replies_post_order_idx;
--   DROP INDEX IF EXISTS public.forum_likes_post_id_idx;
--   DROP INDEX IF EXISTS public.forum_likes_reply_id_idx;
