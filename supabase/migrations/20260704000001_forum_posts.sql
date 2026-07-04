CREATE TABLE IF NOT EXISTS public.forum_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "forum_posts_select" ON public.forum_posts;
CREATE POLICY "forum_posts_select" ON public.forum_posts
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "forum_posts_insert" ON public.forum_posts;
CREATE POLICY "forum_posts_insert" ON public.forum_posts
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id AND public.is_shadchan_or_admin());

DROP POLICY IF EXISTS "forum_posts_delete_own" ON public.forum_posts;
CREATE POLICY "forum_posts_delete_own" ON public.forum_posts
  FOR DELETE TO authenticated
  USING (auth.uid() = author_id OR public.is_admin());
