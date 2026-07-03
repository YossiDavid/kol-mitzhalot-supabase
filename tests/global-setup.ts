import { execSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { FullConfig } from "@playwright/test";

const SCHEMA_SQL = `
DO $$ BEGIN CREATE TYPE public.cellphone_type_enum AS ENUM ('kosher', 'sms', 'protected_smartphone', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.education_type_enum AS ENUM ('yeshiva_ktana', 'yeshiva_gdola', 'kolel', 'seminar'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.gender_enum AS ENUM ('male', 'female'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.head_cover_type_enum AS ENUM ('kerchief', 'wig', 'kerchief_on_wig', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.medical_status_enum AS ENUM ('good', 'littleProblem', 'hugeProblem'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.personal_status_enum AS ENUM ('single', 'divorced', 'widower'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.plan_for_life_enum AS ENUM ('koilel', 'torah_job', 'mix_torah_work', 'work'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.reference_type_enum AS ENUM ('rabbi', 'friend', 'family_friend'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.shidduch_status_enum AS ENUM ('draft', 'sent', 'waiting_response', 'interested', 'more_info_needed', 'in_progress', 'rejected', 'completed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_profiles (id uuid NOT NULL, first_name text, last_name text, email text, updated_at timestamptz DEFAULT now() NOT NULL);
DO $$ BEGIN ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $$;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.students (
  id uuid DEFAULT gen_random_uuid() NOT NULL, user_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(),
  first_name text NOT NULL, last_name text NOT NULL, identity_number text,
  birth_date date NOT NULL, gender public.gender_enum NOT NULL,
  personal_status public.personal_status_enum NOT NULL,
  height numeric, phone text, country text NOT NULL, city text NOT NULL,
  street text, house text, community text, shtible text,
  cellphone_type public.cellphone_type_enum, plan_for_life public.plan_for_life_enum,
  head_cover_type public.head_cover_type_enum,
  image_url text, cv_url text, about text,
  parents_info jsonb DEFAULT '{}', family_info jsonb DEFAULT '{}',
  author_info jsonb DEFAULT '{}', in_shidduchim boolean
);
DO $$ BEGIN ALTER TABLE public.students ADD CONSTRAINT students_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.students ADD CONSTRAINT students_identity_number_key UNIQUE (identity_number); EXCEPTION WHEN others THEN NULL; END $$;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.education_history (id uuid DEFAULT gen_random_uuid() NOT NULL, student_id uuid NOT NULL, institution_type public.education_type_enum NOT NULL, name text, community text, city text);
DO $$ BEGIN ALTER TABLE public.education_history ADD CONSTRAINT education_history_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.education_history ADD CONSTRAINT education_history_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
ALTER TABLE public.education_history ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.employment_history (id uuid DEFAULT gen_random_uuid() NOT NULL, student_id uuid NOT NULL, category text, role text, location text, description text);
DO $$ BEGIN ALTER TABLE public.employment_history ADD CONSTRAINT employment_history_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.employment_history ADD CONSTRAINT employment_history_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
ALTER TABLE public.employment_history ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.medical_records (id uuid DEFAULT gen_random_uuid() NOT NULL, student_id uuid NOT NULL, status public.medical_status_enum, exposure_level text, details text, documents text[], contact_info jsonb, related_issue_preference text);
DO $$ BEGIN ALTER TABLE public.medical_records ADD CONSTRAINT medical_records_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.medical_records ADD CONSTRAINT medical_records_student_id_key UNIQUE (student_id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.medical_records ADD CONSTRAINT medical_records_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.partner_preferences (id uuid DEFAULT gen_random_uuid() NOT NULL, student_id uuid NOT NULL, age_min integer, age_max integer, preferred_countries text[], work_status text, head_cover_type public.head_cover_type_enum, plan_for_life public.plan_for_life_enum, cellphone_type public.cellphone_type_enum, about_partner text, additional_information text);
DO $$ BEGIN ALTER TABLE public.partner_preferences ADD CONSTRAINT partner_preferences_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.partner_preferences ADD CONSTRAINT partner_preferences_student_id_key UNIQUE (student_id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.partner_preferences ADD CONSTRAINT partner_preferences_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
ALTER TABLE public.partner_preferences ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.previous_partners (id uuid DEFAULT gen_random_uuid() NOT NULL, student_id uuid NOT NULL, separation_type text, full_name text, marriage_date date, divorce_date date, death_date date, children_number integer DEFAULT 0, divorce_details jsonb);
DO $$ BEGIN ALTER TABLE public.previous_partners ADD CONSTRAINT previous_partners_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.previous_partners ADD CONSTRAINT previous_partners_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
ALTER TABLE public.previous_partners ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public."references" (id uuid DEFAULT gen_random_uuid() NOT NULL, student_id uuid NOT NULL, reference_type public.reference_type_enum NOT NULL, name text, phone text, email text);
DO $$ BEGIN ALTER TABLE public."references" ADD CONSTRAINT references_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."references" ADD CONSTRAINT references_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
ALTER TABLE public."references" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.shidduchim (id uuid DEFAULT gen_random_uuid() NOT NULL, groom_id uuid NOT NULL, bride_id uuid NOT NULL, shadchan_id uuid NOT NULL, status public.shidduch_status_enum DEFAULT 'draft' NOT NULL, created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL, note_for_groom text, note_for_bride text, recipient_scope text, sent_at timestamptz);
DO $$ BEGIN ALTER TABLE public.shidduchim ADD CONSTRAINT shidduchim_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shidduchim ADD CONSTRAINT unique_shidduch_pair UNIQUE (groom_id, bride_id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shidduchim ADD CONSTRAINT shidduchim_groom_id_fkey FOREIGN KEY (groom_id) REFERENCES public.students(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shidduchim ADD CONSTRAINT shidduchim_bride_id_fkey FOREIGN KEY (bride_id) REFERENCES public.students(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
ALTER TABLE public.shidduchim ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.system_settings (key text NOT NULL, value boolean NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL);
DO $$ BEGIN ALTER TABLE public.system_settings ADD CONSTRAINT system_settings_pkey PRIMARY KEY (key); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.system_settings ADD CONSTRAINT system_settings_key_key UNIQUE (key); EXCEPTION WHEN others THEN NULL; END $$;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.user_roles (user_id uuid PRIMARY KEY, role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin','shadchan','user')), granted_at timestamptz DEFAULT now(), granted_by uuid);
DO $$ BEGIN ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_roles_select_own" ON public.user_roles;
CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "user_roles_select_admin" ON public.user_roles;
CREATE POLICY "user_roles_select_admin" ON public.user_roles FOR SELECT USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.get_my_role() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT role FROM public.user_roles WHERE user_id = auth.uid(); $$;
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT COALESCE(public.get_my_role() = 'admin', false); $$;
CREATE OR REPLACE FUNCTION public.is_admin(uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = uid AND role = 'admin'); $$;
CREATE OR REPLACE FUNCTION public.is_shadchan() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT COALESCE(public.get_my_role() IN ('admin','shadchan'), false); $$;
CREATE OR REPLACE FUNCTION public.is_shadchan_or_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT COALESCE(public.get_my_role() IN ('admin','shadchan'), false); $$;
CREATE OR REPLACE FUNCTION public.sync_user_profile() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','auth' AS $$ DECLARE fn text; ln text; BEGIN fn := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'firstName'),''),NULLIF(TRIM(NEW.raw_user_meta_data->>'first_name'),'')); ln := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'lastName'),''),NULLIF(TRIM(NEW.raw_user_meta_data->>'last_name'),'')); INSERT INTO public.user_profiles (id,first_name,last_name,email,updated_at) VALUES (NEW.id,fn,ln,NEW.email,NOW()) ON CONFLICT (id) DO UPDATE SET first_name=COALESCE(fn,user_profiles.first_name), last_name=COALESCE(ln,user_profiles.last_name), email=COALESCE(NEW.email,user_profiles.email), updated_at=NOW(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.create_full_student_profile(payload jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $func$
DECLARE new_student_id uuid;
BEGIN
  INSERT INTO public.students (user_id,in_shidduchim,first_name,last_name,identity_number,birth_date,gender,personal_status,height,phone,country,city,street,house,community,shtible,cellphone_type,plan_for_life,head_cover_type,image_url,cv_url,about,parents_info,family_info,author_info)
  SELECT (payload->>'user_id')::uuid, COALESCE((payload->>'in_shidduchim')::boolean,true),
    payload->>'first_name', payload->>'last_name', payload->>'identity_number',
    (payload->>'birth_date')::date, (payload->>'gender')::gender_enum,
    (payload->>'personal_status')::personal_status_enum, (payload->>'height')::numeric,
    payload->>'phone', payload->>'country', payload->>'city', payload->>'street', payload->>'house',
    payload->>'community', payload->>'shtible',
    (payload->>'cellphone_type')::cellphone_type_enum, (payload->>'plan_for_life')::plan_for_life_enum,
    (payload->>'head_cover_type')::head_cover_type_enum,
    payload->>'image_url', payload->>'cv_url', payload->>'about',
    COALESCE(payload->'parents_info','{}'), COALESCE(payload->'family_info','{}'), COALESCE(payload->'author_info','{}')
  RETURNING id INTO new_student_id;
  IF payload->'education_history' IS NOT NULL AND jsonb_array_length(payload->'education_history') > 0 THEN
    INSERT INTO public.education_history (student_id,institution_type,name,community,city)
    SELECT new_student_id,(x->>'institution_type')::education_type_enum,x->>'name',x->>'community',x->>'city'
    FROM jsonb_array_elements(payload->'education_history') x;
  END IF;
  IF payload->'employment_history' IS NOT NULL AND jsonb_array_length(payload->'employment_history') > 0 THEN
    INSERT INTO public.employment_history (student_id,category,role,location,description)
    SELECT new_student_id,x->>'category',x->>'role',x->>'location',x->>'description'
    FROM jsonb_array_elements(payload->'employment_history') x;
  END IF;
  IF payload->'medical_records' IS NOT NULL THEN
    INSERT INTO public.medical_records (student_id,status,exposure_level,details,documents,contact_info,related_issue_preference)
    SELECT new_student_id, (payload->'medical_records'->>'status')::medical_status_enum,
      payload->'medical_records'->>'exposure_level', payload->'medical_records'->>'details',
      (SELECT array_agg(x) FROM jsonb_array_elements_text(payload->'medical_records'->'documents') x),
      payload->'medical_records'->'contact_info', payload->'medical_records'->>'related_issue_preference';
  END IF;
  IF payload->'partner_preferences' IS NOT NULL THEN
    INSERT INTO public.partner_preferences (student_id,age_min,age_max,preferred_countries,work_status,head_cover_type,plan_for_life,cellphone_type,about_partner,additional_information)
    SELECT new_student_id,
      (payload->'partner_preferences'->>'age_min')::int, (payload->'partner_preferences'->>'age_max')::int,
      (SELECT array_agg(x) FROM jsonb_array_elements_text(payload->'partner_preferences'->'preferred_countries') x),
      payload->'partner_preferences'->>'work_status',
      (payload->'partner_preferences'->>'head_cover_type')::head_cover_type_enum,
      (payload->'partner_preferences'->>'plan_for_life')::plan_for_life_enum,
      (payload->'partner_preferences'->>'cellphone_type')::cellphone_type_enum,
      payload->'partner_preferences'->>'about_partner', payload->'partner_preferences'->>'additional_information';
  END IF;
  IF payload->'references' IS NOT NULL AND jsonb_array_length(payload->'references') > 0 THEN
    INSERT INTO public.references (student_id,reference_type,name,phone,email)
    SELECT new_student_id,(x->>'reference_type')::reference_type_enum,x->>'name',x->>'phone',x->>'email'
    FROM jsonb_array_elements(payload->'references') x;
  END IF;
  IF payload->'previous_partners' IS NOT NULL AND jsonb_array_length(payload->'previous_partners') > 0 THEN
    INSERT INTO public.previous_partners (student_id,separation_type,full_name,marriage_date,divorce_date,death_date,children_number,divorce_details)
    SELECT new_student_id,x->>'separation_type',x->>'full_name',
      (x->>'marriage_date')::date,(x->>'divorce_date')::date,(x->>'death_date')::date,
      (x->>'children_number')::int,x->'divorce_details'
    FROM jsonb_array_elements(payload->'previous_partners') x;
  END IF;
  RETURN new_student_id;
END;
$func$;

DROP POLICY IF EXISTS "Users can read profiles of users they chat with" ON public.user_profiles;
CREATE POLICY "Users can read profiles of users they chat with" ON public.user_profiles AS PERMISSIVE FOR SELECT TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.students;
CREATE POLICY "Users can insert their own profile" ON public.students AS PERMISSIVE FOR INSERT TO public WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own profile" ON public.students;
CREATE POLICY "Users can update their own profile" ON public.students AS PERMISSIVE FOR UPDATE TO public USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can view own profile or shadchanim see all" ON public.students;
CREATE POLICY "Users can view own profile or shadchanim see all" ON public.students AS PERMISSIVE FOR SELECT TO public USING (auth.uid() = user_id OR is_shadchan_or_admin());
DROP POLICY IF EXISTS "system_settings_select_authenticated" ON public.system_settings;
CREATE POLICY "system_settings_select_authenticated" ON public.system_settings AS PERMISSIVE FOR SELECT TO authenticated USING (true);

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT OR UPDATE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.sync_user_profile();

SELECT pg_notify('pgrst', 'reload schema');
`;

async function globalSetup(_config: FullConfig) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

  if (!supabaseUrl || !accessToken) {
    console.log(
      "[global-setup] Skipping schema setup: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_ACCESS_TOKEN not set",
    );
    return;
  }

  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const tmpFile = path.join(os.tmpdir(), "e2e-schema.sql");
  fs.writeFileSync(tmpFile, SCHEMA_SQL);

  console.log(`[global-setup] Applying schema to project ${projectRef} via Supabase CLI...`);

  const env = { ...process.env, SUPABASE_ACCESS_TOKEN: accessToken };

  try {
    execSync(`npx supabase link --project-ref ${projectRef} --yes`, {
      stdio: "inherit",
      env,
    });
    execSync(`npx supabase db query --linked -f ${tmpFile}`, {
      stdio: "inherit",
      env,
    });
    console.log("[global-setup] Schema applied successfully.");
  } catch (e) {
    console.warn(
      "[global-setup] Schema setup failed — tests may fail if DB schema is missing.\n",
      e,
    );
  }
}

export default globalSetup;
