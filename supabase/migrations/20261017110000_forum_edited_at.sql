-- עריכת פוסטים ותגובות בפורום השדכנים: מתי נערכו לאחרונה (NULL = לא נערך).
-- נכתבת בשרת בלבד (PATCH /api/v1/forum/posts|replies/[id]) בשעון השרת, ומשמשת
-- לסימון "נערך" בעמוד הפוסט. מדיניות ה-UPDATE הקיימת (forum_posts_update,
-- forum_replies_update: author_id = auth.uid()) לא משתנה - מנהל אינו עורך.
-- אידמפוטנטית. להחלה: psql -v ON_ERROR_STOP=1 -f <file>

ALTER TABLE public.forum_posts
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;

ALTER TABLE public.forum_replies
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;

COMMENT ON COLUMN public.forum_posts.edited_at IS
  'מתי הפוסט נערך לאחרונה בידי כותבו (שעון השרת); NULL = לא נערך.';
COMMENT ON COLUMN public.forum_replies.edited_at IS
  'מתי התגובה נערכה לאחרונה בידי כותבה (שעון השרת); NULL = לא נערכה.';

-- ── Rollback (להריץ ידנית) ──
-- ALTER TABLE public.forum_replies DROP COLUMN IF EXISTS edited_at;
-- ALTER TABLE public.forum_posts DROP COLUMN IF EXISTS edited_at;
