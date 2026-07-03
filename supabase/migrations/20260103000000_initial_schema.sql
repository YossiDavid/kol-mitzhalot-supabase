-- ============================================================
-- Initial schema migration — exported from production
-- ============================================================

-- ── Enums ────────────────────────────────────────────────────
CREATE TYPE public.cellphone_type_enum AS ENUM ('kosher', 'sms', 'protected_smartphone', 'other');
CREATE TYPE public.education_type_enum AS ENUM ('yeshiva_ktana', 'yeshiva_gdola', 'kolel', 'seminar');
CREATE TYPE public.gender_enum AS ENUM ('male', 'female');
CREATE TYPE public.head_cover_type_enum AS ENUM ('kerchief', 'wig', 'kerchief_on_wig', 'other');
CREATE TYPE public.medical_status_enum AS ENUM ('good', 'littleProblem', 'hugeProblem');
CREATE TYPE public.personal_status_enum AS ENUM ('single', 'divorced', 'widower');
CREATE TYPE public.plan_for_life_enum AS ENUM ('koilel', 'torah_job', 'mix_torah_work', 'work');
CREATE TYPE public.reference_type_enum AS ENUM ('rabbi', 'friend', 'family_friend');
CREATE TYPE public.shidduch_status_enum AS ENUM ('draft', 'sent', 'waiting_response', 'interested', 'more_info_needed', 'in_progress', 'rejected', 'completed');

-- ── Tables ───────────────────────────────────────────────────
CREATE TABLE public.user_profiles (
  id uuid NOT NULL,
  first_name text,
  last_name text,
  email text,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.students (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  identity_number text,
  birth_date date NOT NULL,
  gender public.gender_enum NOT NULL,
  personal_status public.personal_status_enum NOT NULL,
  height numeric,
  phone text,
  country text NOT NULL,
  city text NOT NULL,
  street text,
  house text,
  community text,
  shtible text,
  cellphone_type public.cellphone_type_enum,
  plan_for_life public.plan_for_life_enum,
  head_cover_type public.head_cover_type_enum,
  image_url text,
  cv_url text,
  about text,
  parents_info jsonb DEFAULT '{}'::jsonb,
  family_info jsonb DEFAULT '{}'::jsonb,
  author_info jsonb DEFAULT '{}'::jsonb,
  in_shidduchim boolean
);

CREATE TABLE public.education_history (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  student_id uuid NOT NULL,
  institution_type public.education_type_enum NOT NULL,
  name text,
  community text,
  city text
);

CREATE TABLE public.employment_history (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  student_id uuid NOT NULL,
  category text,
  role text,
  location text,
  description text
);

CREATE TABLE public.medical_records (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  student_id uuid NOT NULL,
  status public.medical_status_enum,
  exposure_level text,
  details text,
  documents text[],
  contact_info jsonb,
  related_issue_preference text
);

CREATE TABLE public.partner_preferences (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  student_id uuid NOT NULL,
  age_min integer,
  age_max integer,
  preferred_countries text[],
  work_status text,
  head_cover_type public.head_cover_type_enum,
  plan_for_life public.plan_for_life_enum,
  cellphone_type public.cellphone_type_enum,
  about_partner text,
  additional_information text
);

CREATE TABLE public.previous_partners (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  student_id uuid NOT NULL,
  separation_type text,
  full_name text,
  marriage_date date,
  divorce_date date,
  death_date date,
  children_number integer DEFAULT 0,
  divorce_details jsonb
);

CREATE TABLE public."references" (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  student_id uuid NOT NULL,
  reference_type public.reference_type_enum NOT NULL,
  name text,
  phone text,
  email text
);

CREATE TABLE public.shadchanim_info (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  bio text,
  experience_years integer,
  specializations text[],
  contact_phone text,
  contact_email text,
  website_url text,
  location text,
  languages text[],
  certifications text[],
  additional_info jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  application_status text,
  submitted_at timestamp with time zone,
  approved_at timestamp with time zone,
  rejected_at timestamp with time zone,
  rejected_reason text
);

CREATE TABLE public.shidduchim (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  groom_id uuid NOT NULL,
  bride_id uuid NOT NULL,
  shadchan_id uuid NOT NULL,
  status public.shidduch_status_enum DEFAULT 'draft'::public.shidduch_status_enum NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  note_for_groom text,
  note_for_bride text,
  recipient_scope text,
  sent_at timestamp with time zone
);

CREATE TABLE public.chat_rooms (
  room_id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_a uuid NOT NULL,
  user_b uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  last_message_id uuid,
  last_message_at timestamp with time zone,
  created_by uuid NOT NULL
);

CREATE TABLE public.chat_room_participants (
  room_id uuid NOT NULL,
  user_id uuid NOT NULL,
  joined_at timestamp with time zone DEFAULT now() NOT NULL,
  last_read_at timestamp with time zone,
  hidden_at timestamp with time zone,
  deleted_before timestamp with time zone
);

CREATE TABLE public.chat_messages (
  message_id uuid DEFAULT gen_random_uuid() NOT NULL,
  room_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  edited_at timestamp with time zone,
  reply_to_message_id uuid
);

CREATE TABLE public.system_content (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  key text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.system_settings (
  key text NOT NULL,
  value boolean NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.forum_categories (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  description text,
  slug text NOT NULL,
  icon text,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.forum_posts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  author_id uuid NOT NULL,
  is_pinned boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  category_id uuid,
  tags text[] DEFAULT '{}'::text[]
);

CREATE TABLE public.forum_replies (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  post_id uuid NOT NULL,
  content text NOT NULL,
  author_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.forum_likes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  post_id uuid,
  reply_id uuid,
  created_at timestamp with time zone DEFAULT now()
);

-- ── Primary Keys ─────────────────────────────────────────────
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (id);
ALTER TABLE public.students ADD CONSTRAINT students_pkey PRIMARY KEY (id);
ALTER TABLE public.education_history ADD CONSTRAINT education_history_pkey PRIMARY KEY (id);
ALTER TABLE public.employment_history ADD CONSTRAINT employment_history_pkey PRIMARY KEY (id);
ALTER TABLE public.medical_records ADD CONSTRAINT medical_records_pkey PRIMARY KEY (id);
ALTER TABLE public.partner_preferences ADD CONSTRAINT partner_preferences_pkey PRIMARY KEY (id);
ALTER TABLE public.previous_partners ADD CONSTRAINT previous_partners_pkey PRIMARY KEY (id);
ALTER TABLE public."references" ADD CONSTRAINT references_pkey PRIMARY KEY (id);
ALTER TABLE public.shadchanim_info ADD CONSTRAINT shadchanim_info_pkey PRIMARY KEY (id);
ALTER TABLE public.shidduchim ADD CONSTRAINT shidduchim_pkey PRIMARY KEY (id);
ALTER TABLE public.chat_rooms ADD CONSTRAINT chat_rooms_pkey PRIMARY KEY (room_id);
ALTER TABLE public.chat_room_participants ADD CONSTRAINT chat_room_participants_pkey PRIMARY KEY (room_id, user_id);
ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (message_id);
ALTER TABLE public.system_content ADD CONSTRAINT system_content_pkey PRIMARY KEY (id);
ALTER TABLE public.system_settings ADD CONSTRAINT system_settings_pkey PRIMARY KEY (key);
ALTER TABLE public.forum_categories ADD CONSTRAINT forum_categories_pkey PRIMARY KEY (id);
ALTER TABLE public.forum_posts ADD CONSTRAINT forum_posts_pkey PRIMARY KEY (id);
ALTER TABLE public.forum_replies ADD CONSTRAINT forum_replies_pkey PRIMARY KEY (id);
ALTER TABLE public.forum_likes ADD CONSTRAINT forum_likes_pkey PRIMARY KEY (id);

-- ── Unique Constraints ───────────────────────────────────────
ALTER TABLE public.students ADD CONSTRAINT students_identity_number_key UNIQUE (identity_number);
ALTER TABLE public.medical_records ADD CONSTRAINT medical_records_student_id_key UNIQUE (student_id);
ALTER TABLE public.partner_preferences ADD CONSTRAINT partner_preferences_student_id_key UNIQUE (student_id);
ALTER TABLE public.shadchanim_info ADD CONSTRAINT shadchanim_info_user_id_key UNIQUE (user_id);
ALTER TABLE public.shidduchim ADD CONSTRAINT unique_shidduch_pair UNIQUE (groom_id, bride_id);
ALTER TABLE public.system_content ADD CONSTRAINT system_content_key_key UNIQUE (key);
ALTER TABLE public.forum_categories ADD CONSTRAINT forum_categories_slug_key UNIQUE (slug);
ALTER TABLE public.forum_likes ADD CONSTRAINT forum_likes_user_id_post_id_key UNIQUE (user_id, post_id);
ALTER TABLE public.forum_likes ADD CONSTRAINT forum_likes_user_id_reply_id_key UNIQUE (user_id, reply_id);

-- ── Foreign Keys ─────────────────────────────────────────────
ALTER TABLE public.education_history ADD CONSTRAINT education_history_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
ALTER TABLE public.employment_history ADD CONSTRAINT employment_history_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
ALTER TABLE public.medical_records ADD CONSTRAINT medical_records_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
ALTER TABLE public.partner_preferences ADD CONSTRAINT partner_preferences_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
ALTER TABLE public.previous_partners ADD CONSTRAINT previous_partners_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
ALTER TABLE public."references" ADD CONSTRAINT references_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
ALTER TABLE public.shidduchim ADD CONSTRAINT shidduchim_groom_id_fkey FOREIGN KEY (groom_id) REFERENCES public.students(id) ON DELETE CASCADE;
ALTER TABLE public.shidduchim ADD CONSTRAINT shidduchim_bride_id_fkey FOREIGN KEY (bride_id) REFERENCES public.students(id) ON DELETE CASCADE;
ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.chat_rooms(room_id) ON DELETE CASCADE;
ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_reply_fk FOREIGN KEY (reply_to_message_id) REFERENCES public.chat_messages(message_id) ON DELETE SET NULL;
ALTER TABLE public.chat_room_participants ADD CONSTRAINT chat_room_participants_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.chat_rooms(room_id) ON DELETE CASCADE;
ALTER TABLE public.chat_rooms ADD CONSTRAINT chat_rooms_last_message_fk FOREIGN KEY (last_message_id) REFERENCES public.chat_messages(message_id) ON DELETE SET NULL;
ALTER TABLE public.forum_posts ADD CONSTRAINT forum_posts_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.forum_categories(id) ON DELETE SET NULL;
ALTER TABLE public.forum_replies ADD CONSTRAINT forum_replies_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.forum_posts(id) ON DELETE CASCADE;
ALTER TABLE public.forum_likes ADD CONSTRAINT forum_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.forum_posts(id) ON DELETE CASCADE;
ALTER TABLE public.forum_likes ADD CONSTRAINT forum_likes_reply_id_fkey FOREIGN KEY (reply_id) REFERENCES public.forum_replies(id) ON DELETE CASCADE;

-- ── Functions ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path TO 'public', 'auth'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND (raw_user_meta_data->>'role')::text = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
  RETURNS boolean LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT COALESCE((raw_user_meta_data->>'role')::text = 'admin', false)
  FROM auth.users WHERE id = uid;
$$;

CREATE OR REPLACE FUNCTION public.is_shadchan()
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path TO 'public', 'auth'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND (raw_user_meta_data->>'role')::text = 'shadchan'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_shadchan_or_admin()
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path TO 'public', 'auth'
AS $$
  SELECT public.is_admin() OR public.is_shadchan();
$$;

CREATE OR REPLACE FUNCTION public.is_approved_shadchan(uid uuid)
  RETURNS boolean LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM shadchanim_info
    WHERE user_id = uid AND application_status = 'approved'
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_metadata(target_user_id uuid)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  profile_data JSONB;
BEGIN
  SELECT jsonb_build_object(
    'id', id, 'firstName', first_name, 'lastName', last_name, 'email', email
  ) INTO profile_data
  FROM public.user_profiles WHERE id = target_user_id;
  RETURN profile_data;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_user_profile()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public', 'auth'
AS $$
DECLARE
  fn text;
  ln text;
BEGIN
  fn := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'firstName'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'first_name'), '')
  );
  ln := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'lastName'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'last_name'), '')
  );
  INSERT INTO public.user_profiles (id, first_name, last_name, email, updated_at)
  VALUES (NEW.id, fn, ln, NEW.email, NOW())
  ON CONFLICT (id) DO UPDATE SET
    first_name = COALESCE(fn, user_profiles.first_name),
    last_name  = COALESCE(ln, user_profiles.last_name),
    email      = COALESCE(NEW.email, user_profiles.email),
    updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_full_student_profile(payload jsonb)
  RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  new_student_id uuid;
BEGIN
  INSERT INTO public.students (
    user_id, in_shidduchim, first_name, last_name, identity_number, birth_date, gender,
    personal_status, height, phone, country, city, street, house, community,
    shtible, cellphone_type, plan_for_life, head_cover_type, image_url,
    cv_url, about, parents_info, family_info, author_info
  ) SELECT
    (payload->>'user_id')::uuid,
    COALESCE((payload->>'in_shidduchim')::boolean, true),
    payload->>'first_name', payload->>'last_name', payload->>'identity_number',
    (payload->>'birth_date')::date,
    (payload->>'gender')::gender_enum,
    (payload->>'personal_status')::personal_status_enum,
    (payload->>'height')::numeric,
    payload->>'phone', payload->>'country', payload->>'city',
    payload->>'street', payload->>'house', payload->>'community', payload->>'shtible',
    (payload->>'cellphone_type')::cellphone_type_enum,
    (payload->>'plan_for_life')::plan_for_life_enum,
    (payload->>'head_cover_type')::head_cover_type_enum,
    payload->>'image_url', payload->>'cv_url', payload->>'about',
    COALESCE(payload->'parents_info', '{}'::jsonb),
    COALESCE(payload->'family_info', '{}'::jsonb),
    COALESCE(payload->'author_info', '{}'::jsonb)
  RETURNING id INTO new_student_id;

  IF payload->'education_history' IS NOT NULL AND jsonb_array_length(payload->'education_history') > 0 THEN
    INSERT INTO public.education_history (student_id, institution_type, name, community, city)
    SELECT new_student_id, (x->>'institution_type')::education_type_enum,
      x->>'name', x->>'community', x->>'city'
    FROM jsonb_array_elements(payload->'education_history') x;
  END IF;

  IF payload->'employment_history' IS NOT NULL AND jsonb_array_length(payload->'employment_history') > 0 THEN
    INSERT INTO public.employment_history (student_id, category, role, location, description)
    SELECT new_student_id, x->>'category', x->>'role', x->>'location', x->>'description'
    FROM jsonb_array_elements(payload->'employment_history') x;
  END IF;

  IF payload->'medical_records' IS NOT NULL THEN
    INSERT INTO public.medical_records (student_id, status, exposure_level, details, documents, contact_info, related_issue_preference)
    SELECT new_student_id,
      (payload->'medical_records'->>'status')::medical_status_enum,
      payload->'medical_records'->>'exposure_level',
      payload->'medical_records'->>'details',
      (SELECT array_agg(x) FROM jsonb_array_elements_text(payload->'medical_records'->'documents') x),
      payload->'medical_records'->'contact_info',
      payload->'medical_records'->>'related_issue_preference';
  END IF;

  IF payload->'partner_preferences' IS NOT NULL THEN
    INSERT INTO public.partner_preferences (student_id, age_min, age_max, preferred_countries, work_status, head_cover_type, plan_for_life, cellphone_type, about_partner, additional_information)
    SELECT new_student_id,
      (payload->'partner_preferences'->>'age_min')::int,
      (payload->'partner_preferences'->>'age_max')::int,
      (SELECT array_agg(x) FROM jsonb_array_elements_text(payload->'partner_preferences'->'preferred_countries') x),
      payload->'partner_preferences'->>'work_status',
      (payload->'partner_preferences'->>'head_cover_type')::head_cover_type_enum,
      (payload->'partner_preferences'->>'plan_for_life')::plan_for_life_enum,
      (payload->'partner_preferences'->>'cellphone_type')::cellphone_type_enum,
      payload->'partner_preferences'->>'about_partner',
      payload->'partner_preferences'->>'additional_information';
  END IF;

  IF payload->'references' IS NOT NULL AND jsonb_array_length(payload->'references') > 0 THEN
    INSERT INTO public.references (student_id, reference_type, name, phone, email)
    SELECT new_student_id, (x->>'reference_type')::reference_type_enum,
      x->>'name', x->>'phone', x->>'email'
    FROM jsonb_array_elements(payload->'references') x;
  END IF;

  IF payload->'previous_partners' IS NOT NULL AND jsonb_array_length(payload->'previous_partners') > 0 THEN
    INSERT INTO public.previous_partners (student_id, separation_type, full_name, marriage_date, divorce_date, death_date, children_number, divorce_details)
    SELECT new_student_id, x->>'separation_type', x->>'full_name',
      (x->>'marriage_date')::date, (x->>'divorce_date')::date, (x->>'death_date')::date,
      (x->>'children_number')::int, x->'divorce_details'
    FROM jsonb_array_elements(payload->'previous_partners') x;
  END IF;

  RETURN new_student_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_canonical_pair(u1 uuid, u2 uuid)
  RETURNS TABLE(user_a uuid, user_b uuid) LANGUAGE sql IMMUTABLE
AS $$
  SELECT least(u1, u2) AS user_a, greatest(u1, u2) AS user_b;
$$;

CREATE OR REPLACE FUNCTION public.get_or_create_dm_room(other_user_id uuid)
  RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  me uuid := auth.uid();
  a uuid; b uuid; rid uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF other_user_id IS NULL OR other_user_id = me THEN RAISE EXCEPTION 'Invalid other_user_id'; END IF;
  SELECT user_a, user_b INTO a, b FROM public.chat_canonical_pair(me, other_user_id);
  SELECT room_id INTO rid FROM public.chat_rooms WHERE user_a = a AND user_b = b;
  IF rid IS NOT NULL THEN RETURN rid; END IF;
  INSERT INTO public.chat_rooms(user_a, user_b, created_by) VALUES (a, b, me) RETURNING room_id INTO rid;
  INSERT INTO public.chat_room_participants(room_id, user_id) VALUES (rid, me), (rid, other_user_id);
  RETURN rid;
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_rooms_set_last_message()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.chat_rooms r
  SET last_message_id = NEW.message_id, last_message_at = NEW.created_at
  WHERE r.room_id = NEW.room_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_shadchanim_info_updated_at()
  RETURNS trigger LANGUAGE plpgsql
AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION public.update_shidduchim_updated_at()
  RETURNS trigger LANGUAGE plpgsql
AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION public.update_system_content_updated_at()
  RETURNS trigger LANGUAGE plpgsql
AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION public.validate_shidduch_genders()
  RETURNS trigger LANGUAGE plpgsql
AS $$
DECLARE
  groom_gender gender_enum;
  bride_gender gender_enum;
BEGIN
  SELECT gender INTO groom_gender FROM public.students WHERE id = NEW.groom_id;
  IF groom_gender IS NULL THEN RAISE EXCEPTION 'Groom student not found'; END IF;
  IF groom_gender != 'male' THEN RAISE EXCEPTION 'Groom must be male'; END IF;
  SELECT gender INTO bride_gender FROM public.students WHERE id = NEW.bride_id;
  IF bride_gender IS NULL THEN RAISE EXCEPTION 'Bride student not found'; END IF;
  IF bride_gender != 'female' THEN RAISE EXCEPTION 'Bride must be female'; END IF;
  RETURN NEW;
END;
$$;

-- ── Triggers ─────────────────────────────────────────────────
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_profile();

CREATE TRIGGER trg_chat_rooms_set_last_message
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.chat_rooms_set_last_message();

CREATE TRIGGER trigger_update_shadchanim_info_updated_at
  BEFORE UPDATE ON public.shadchanim_info
  FOR EACH ROW EXECUTE FUNCTION public.update_shadchanim_info_updated_at();

CREATE TRIGGER trigger_update_shidduchim_updated_at
  BEFORE UPDATE ON public.shidduchim
  FOR EACH ROW EXECUTE FUNCTION public.update_shidduchim_updated_at();

CREATE TRIGGER trigger_update_system_content_updated_at
  BEFORE UPDATE ON public.system_content
  FOR EACH ROW EXECUTE FUNCTION public.update_system_content_updated_at();

CREATE TRIGGER trigger_validate_shidduch_genders
  BEFORE INSERT OR UPDATE ON public.shidduchim
  FOR EACH ROW EXECUTE FUNCTION public.validate_shidduch_genders();

-- ── Enable RLS ───────────────────────────────────────────────
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.education_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.previous_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."references" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shadchanim_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shidduchim ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_likes ENABLE ROW LEVEL SECURITY;

-- ── RLS Policies ─────────────────────────────────────────────
-- user_profiles
CREATE POLICY "Users can read profiles of users they chat with"
  ON public.user_profiles AS PERMISSIVE FOR SELECT TO authenticated
  USING ((( SELECT auth.uid() AS uid) = id) OR (EXISTS (
    SELECT 1 FROM (chat_room_participants crp1
      JOIN chat_room_participants crp2 ON (crp1.room_id = crp2.room_id))
    WHERE (crp1.user_id = ( SELECT auth.uid() AS uid)) AND (crp2.user_id = user_profiles.id)
      AND (crp1.deleted_before IS NULL) AND (crp2.deleted_before IS NULL))));

-- students
CREATE POLICY "Users can insert their own profile"
  ON public.students AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (( SELECT auth.uid() AS uid) = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.students AS PERMISSIVE FOR UPDATE TO public
  USING (( SELECT auth.uid() AS uid) = user_id);

CREATE POLICY "Users can view own profile or shadchanim see all"
  ON public.students AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id) OR is_shadchan_or_admin());

-- education_history
CREATE POLICY "Users can insert education history for their students"
  ON public.education_history AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM students WHERE students.id = education_history.student_id AND students.user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Users read own students or shadchanim see all"
  ON public.education_history AS PERMISSIVE FOR SELECT TO public
  USING (is_shadchan_or_admin() OR (EXISTS (SELECT 1 FROM students WHERE students.id = education_history.student_id AND students.user_id = auth.uid())));

-- employment_history
CREATE POLICY "Users can insert employment history for their students"
  ON public.employment_history AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM students WHERE students.id = employment_history.student_id AND students.user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Users read own students or shadchanim see all"
  ON public.employment_history AS PERMISSIVE FOR SELECT TO public
  USING (is_shadchan_or_admin() OR (EXISTS (SELECT 1 FROM students WHERE students.id = employment_history.student_id AND students.user_id = auth.uid())));

-- medical_records
CREATE POLICY "Users can insert medical records for their students"
  ON public.medical_records AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM students WHERE students.id = medical_records.student_id AND students.user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Users can update medical records for their students"
  ON public.medical_records AS PERMISSIVE FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM students WHERE students.id = medical_records.student_id AND students.user_id = ( SELECT auth.uid() AS uid)))
  WITH CHECK (EXISTS (SELECT 1 FROM students WHERE students.id = medical_records.student_id AND students.user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Users read own students or shadchanim see all"
  ON public.medical_records AS PERMISSIVE FOR SELECT TO public
  USING (is_shadchan_or_admin() OR (EXISTS (SELECT 1 FROM students WHERE students.id = medical_records.student_id AND students.user_id = auth.uid())));

-- partner_preferences
CREATE POLICY "Users can insert partner preferences for their students"
  ON public.partner_preferences AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM students WHERE students.id = partner_preferences.student_id AND students.user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Users read own students or shadchanim see all"
  ON public.partner_preferences AS PERMISSIVE FOR SELECT TO public
  USING (is_shadchan_or_admin() OR (EXISTS (SELECT 1 FROM students WHERE students.id = partner_preferences.student_id AND students.user_id = auth.uid())));

-- previous_partners
CREATE POLICY "Users can insert previous partners for their students"
  ON public.previous_partners AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM students WHERE students.id = previous_partners.student_id AND students.user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Users read own students or shadchanim see all"
  ON public.previous_partners AS PERMISSIVE FOR SELECT TO public
  USING (is_shadchan_or_admin() OR (EXISTS (SELECT 1 FROM students WHERE students.id = previous_partners.student_id AND students.user_id = auth.uid())));

-- references
CREATE POLICY "Users can insert references for their students"
  ON public."references" AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM students WHERE students.id = "references".student_id AND students.user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Users read own students or shadchanim see all"
  ON public."references" AS PERMISSIVE FOR SELECT TO public
  USING (is_shadchan_or_admin() OR (EXISTS (SELECT 1 FROM students WHERE students.id = "references".student_id AND students.user_id = auth.uid())));

-- shadchanim_info
CREATE POLICY "Shadchanim_info delete admin only"
  ON public.shadchanim_info AS PERMISSIVE FOR DELETE TO public
  USING (is_admin());

CREATE POLICY "Shadchanim_info insert own or admin"
  ON public.shadchanim_info AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (is_admin() OR (auth.uid() = user_id));

CREATE POLICY "Shadchanim_info select own or admin"
  ON public.shadchanim_info AS PERMISSIVE FOR SELECT TO public
  USING (is_admin() OR (auth.uid() = user_id));

CREATE POLICY "Shadchanim_info update own or admin"
  ON public.shadchanim_info AS PERMISSIVE FOR UPDATE TO public
  USING (is_admin() OR (auth.uid() = user_id))
  WITH CHECK (is_admin() OR (auth.uid() = user_id));

-- shidduchim
CREATE POLICY "Admins can view all shidduchim"
  ON public.shidduchim AS PERMISSIVE FOR SELECT TO public
  USING (is_admin());

CREATE POLICY "Parents can view shidduchim involving their students"
  ON public.shidduchim AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS (SELECT 1 FROM students s WHERE s.id = shidduchim.groom_id AND s.user_id = ( SELECT auth.uid() AS uid)))
      OR (EXISTS (SELECT 1 FROM students s WHERE s.id = shidduchim.bride_id AND s.user_id = ( SELECT auth.uid() AS uid))));

CREATE POLICY "Users can create shidduchim"
  ON public.shidduchim AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (( SELECT auth.uid() AS uid) = shadchan_id);

CREATE POLICY "Users can delete their own shidduchim"
  ON public.shidduchim AS PERMISSIVE FOR DELETE TO public
  USING (( SELECT auth.uid() AS uid) = shadchan_id);

CREATE POLICY "Users can update their own shidduchim"
  ON public.shidduchim AS PERMISSIVE FOR UPDATE TO public
  USING (( SELECT auth.uid() AS uid) = shadchan_id)
  WITH CHECK (( SELECT auth.uid() AS uid) = shadchan_id);

CREATE POLICY "Users can view their own shidduchim as shadchan"
  ON public.shidduchim AS PERMISSIVE FOR SELECT TO public
  USING (( SELECT auth.uid() AS uid) = shadchan_id);

-- chat_rooms
CREATE POLICY "rooms_insert_creator_canonical"
  ON public.chat_rooms AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (created_by = ( SELECT auth.uid() AS uid) AND user_a < user_b AND user_a <> user_b
    AND ((( SELECT auth.uid() AS uid) = user_a) OR (( SELECT auth.uid() AS uid) = user_b)));

CREATE POLICY "rooms_no_client_update"
  ON public.chat_rooms AS PERMISSIVE FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "rooms_select_participants"
  ON public.chat_rooms AS PERMISSIVE FOR SELECT TO authenticated
  USING ((( SELECT auth.uid() AS uid) = user_a) OR (( SELECT auth.uid() AS uid) = user_b));

-- chat_room_participants
CREATE POLICY "participants_insert_room_creator"
  ON public.chat_room_participants AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM chat_rooms r WHERE r.room_id = chat_room_participants.room_id AND r.created_by = ( SELECT auth.uid() AS uid)));

CREATE POLICY "participants_no_delete"
  ON public.chat_room_participants AS PERMISSIVE FOR DELETE TO authenticated
  USING (false);

CREATE POLICY "participants_select_in_my_rooms"
  ON public.chat_room_participants AS PERMISSIVE FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM chat_rooms r WHERE r.room_id = chat_room_participants.room_id
    AND ((( SELECT auth.uid() AS uid) = r.user_a) OR (( SELECT auth.uid() AS uid) = r.user_b))));

CREATE POLICY "participants_update_self_only"
  ON public.chat_room_participants AS PERMISSIVE FOR UPDATE TO authenticated
  USING (( SELECT auth.uid() AS uid) = user_id)
  WITH CHECK (( SELECT auth.uid() AS uid) = user_id);

-- chat_messages
CREATE POLICY "messages_insert_sender_is_participant"
  ON public.chat_messages AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (( SELECT auth.uid() AS uid) = sender_id
    AND (EXISTS (SELECT 1 FROM chat_room_participants p
      WHERE p.room_id = chat_messages.room_id AND p.user_id = ( SELECT auth.uid() AS uid))));

CREATE POLICY "messages_no_delete"
  ON public.chat_messages AS PERMISSIVE FOR DELETE TO authenticated
  USING (false);

CREATE POLICY "messages_select_participants"
  ON public.chat_messages AS PERMISSIVE FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM chat_room_participants p
    WHERE p.room_id = chat_messages.room_id AND p.user_id = ( SELECT auth.uid() AS uid)
      AND (p.deleted_before IS NULL OR chat_messages.created_at > p.deleted_before)
      AND p.hidden_at IS NULL));

CREATE POLICY "chat_messages_update_own_within_7m"
  ON public.chat_messages AS PERMISSIVE FOR UPDATE TO authenticated
  USING (sender_id = ( SELECT auth.uid() AS uid) AND created_at > (now() - '00:07:00'::interval))
  WITH CHECK (sender_id = ( SELECT auth.uid() AS uid) AND created_at > (now() - '00:07:00'::interval));

-- system_content
CREATE POLICY "Anyone can read system content"
  ON public.system_content AS PERMISSIVE FOR SELECT TO public USING (true);

CREATE POLICY "Only admins can delete system content"
  ON public.system_content AS PERMISSIVE FOR DELETE TO public
  USING (( SELECT is_admin() AS is_admin));

CREATE POLICY "Only admins can modify system content"
  ON public.system_content AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (( SELECT is_admin() AS is_admin));

CREATE POLICY "Only admins can update system content"
  ON public.system_content AS PERMISSIVE FOR UPDATE TO public
  USING (( SELECT is_admin() AS is_admin))
  WITH CHECK (( SELECT is_admin() AS is_admin));

-- system_settings
CREATE POLICY "system_settings_select_authenticated"
  ON public.system_settings AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

-- forum_categories
CREATE POLICY "categories_select"
  ON public.forum_categories AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY "categories_insert"
  ON public.forum_categories AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "categories_update"
  ON public.forum_categories AS PERMISSIVE FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "categories_delete"
  ON public.forum_categories AS PERMISSIVE FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));

-- forum_posts
CREATE POLICY "forum_posts_select"
  ON public.forum_posts AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY "forum_posts_insert"
  ON public.forum_posts AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (is_approved_shadchan(auth.uid()) OR is_admin(auth.uid()));

CREATE POLICY "forum_posts_update"
  ON public.forum_posts AS PERMISSIVE FOR UPDATE TO authenticated
  USING (author_id = auth.uid());

CREATE POLICY "forum_posts_delete"
  ON public.forum_posts AS PERMISSIVE FOR DELETE TO authenticated
  USING ((author_id = auth.uid()) OR is_admin(auth.uid()));

-- forum_replies
CREATE POLICY "forum_replies_select"
  ON public.forum_replies AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY "forum_replies_insert"
  ON public.forum_replies AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (is_approved_shadchan(auth.uid()) OR is_admin(auth.uid()));

CREATE POLICY "forum_replies_update"
  ON public.forum_replies AS PERMISSIVE FOR UPDATE TO authenticated
  USING (author_id = auth.uid());

CREATE POLICY "forum_replies_delete"
  ON public.forum_replies AS PERMISSIVE FOR DELETE TO authenticated
  USING ((author_id = auth.uid()) OR is_admin(auth.uid()));

-- forum_likes
CREATE POLICY "likes_select"
  ON public.forum_likes AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY "likes_insert"
  ON public.forum_likes AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (is_approved_shadchan(auth.uid()) OR is_admin(auth.uid()));

CREATE POLICY "likes_delete"
  ON public.forum_likes AS PERMISSIVE FOR DELETE TO authenticated
  USING (user_id = auth.uid());
