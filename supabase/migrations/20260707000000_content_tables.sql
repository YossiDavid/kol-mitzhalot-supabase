-- Content tables: articles, engagements, endorsements

-- Articles
CREATE TABLE public.articles (
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

CREATE POLICY "articles_public_select" ON public.articles
  FOR SELECT USING (is_published = true);

CREATE POLICY "articles_admin_all" ON public.articles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Engagements
CREATE TABLE public.engagements (
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

CREATE POLICY "engagements_public_select" ON public.engagements
  FOR SELECT USING (is_published = true);

CREATE POLICY "engagements_admin_all" ON public.engagements
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Endorsements (rabbinical)
CREATE TABLE public.endorsements (
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

CREATE POLICY "endorsements_public_select" ON public.endorsements
  FOR SELECT USING (is_published = true);

CREATE POLICY "endorsements_admin_all" ON public.endorsements
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
