


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."User Roles" AS ENUM (
    'admin',
    'user',
    'shadchan'
);


ALTER TYPE "public"."User Roles" OWNER TO "postgres";


CREATE TYPE "public"."cellphone_type_enum" AS ENUM (
    'kosher',
    'sms',
    'protected_smartphone',
    'other'
);


ALTER TYPE "public"."cellphone_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."education_type_enum" AS ENUM (
    'yeshiva_ktana',
    'yeshiva_gdola',
    'kolel',
    'seminar'
);


ALTER TYPE "public"."education_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."gender_enum" AS ENUM (
    'male',
    'female'
);


ALTER TYPE "public"."gender_enum" OWNER TO "postgres";


CREATE TYPE "public"."head_cover_type_enum" AS ENUM (
    'kerchief',
    'wig',
    'kerchief_on_wig',
    'other'
);


ALTER TYPE "public"."head_cover_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."medical_status_enum" AS ENUM (
    'good',
    'littleProblem',
    'hugeProblem'
);


ALTER TYPE "public"."medical_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."personal_status_enum" AS ENUM (
    'single',
    'divorced',
    'widower'
);


ALTER TYPE "public"."personal_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."plan_for_life_enum" AS ENUM (
    'koilel',
    'torah_job',
    'mix_torah_work',
    'work'
);


ALTER TYPE "public"."plan_for_life_enum" OWNER TO "postgres";


CREATE TYPE "public"."reference_type_enum" AS ENUM (
    'rabbi',
    'friend',
    'family_friend'
);


ALTER TYPE "public"."reference_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."shidduch_status_enum" AS ENUM (
    'draft',
    'sent',
    'waiting_response',
    'interested',
    'more_info_needed',
    'in_progress',
    'rejected',
    'completed'
);


ALTER TYPE "public"."shidduch_status_enum" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."chat_canonical_pair"("u1" "uuid", "u2" "uuid") RETURNS TABLE("user_a" "uuid", "user_b" "uuid")
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select least(u1,u2) as user_a, greatest(u1,u2) as user_b;
$$;


ALTER FUNCTION "public"."chat_canonical_pair"("u1" "uuid", "u2" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."chat_rooms_set_last_message"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  update public.chat_rooms r
  set last_message_id = new.message_id,
      last_message_at = new.created_at
  where r.room_id = new.room_id;

  return new;
end;
$$;


ALTER FUNCTION "public"."chat_rooms_set_last_message"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_full_student_profile"("payload" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  new_student_id uuid;
BEGIN
  INSERT INTO public.students (
    user_id, in_shidduchim, first_name, last_name, identity_number, birth_date, gender,
    personal_status, height, phone, country, city, street, house, community,
    shtible, cellphone_type, plan_for_life, head_cover_type, image_url,
    cv_url, about, parents_info, family_info, author_info
  )
  SELECT
    (payload->>'user_id')::uuid,
    COALESCE((payload->>'in_shidduchim')::boolean, true),
    payload->>'first_name',
    payload->>'last_name',
    payload->>'identity_number',
    (payload->>'birth_date')::date,
    (payload->>'gender')::gender_enum,
    (payload->>'personal_status')::personal_status_enum,
    (payload->>'height')::numeric,
    payload->>'phone',
    payload->>'country',
    payload->>'city',
    payload->>'street',
    payload->>'house',
    payload->>'community',
    payload->>'shtible',
    (payload->>'cellphone_type')::cellphone_type_enum,
    (payload->>'plan_for_life')::plan_for_life_enum,
    (payload->>'head_cover_type')::head_cover_type_enum,
    payload->>'image_url',
    payload->>'cv_url',
    payload->>'about',
    COALESCE(payload->'parents_info', '{}'::jsonb),
    COALESCE(payload->'family_info', '{}'::jsonb),
    COALESCE(payload->'author_info', '{}'::jsonb)
  RETURNING id INTO new_student_id;

  IF payload->'education_history' IS NOT NULL AND jsonb_array_length(payload->'education_history') > 0 THEN
    INSERT INTO public.education_history (student_id, institution_type, name, community, city)
    SELECT
      new_student_id,
      (x->>'institution_type')::education_type_enum,
      x->>'name',
      x->>'community',
      x->>'city'
    FROM jsonb_array_elements(payload->'education_history') x;
  END IF;

  IF payload->'employment_history' IS NOT NULL AND jsonb_array_length(payload->'employment_history') > 0 THEN
    INSERT INTO public.employment_history (student_id, category, role, location, description)
    SELECT
      new_student_id,
      x->>'category',
      x->>'role',
      x->>'location',
      x->>'description'
    FROM jsonb_array_elements(payload->'employment_history') x;
  END IF;

  IF payload->'medical_records' IS NOT NULL THEN
    INSERT INTO public.medical_records (student_id, status, exposure_level, details, documents, contact_info, related_issue_preference)
    SELECT
      new_student_id,
      (payload->'medical_records'->>'status')::medical_status_enum,
      payload->'medical_records'->>'exposure_level',
      payload->'medical_records'->>'details',
      (SELECT array_agg(x) FROM jsonb_array_elements_text(payload->'medical_records'->'documents') x),
      payload->'medical_records'->'contact_info',
      payload->'medical_records'->>'related_issue_preference';
  END IF;

  IF payload->'partner_preferences' IS NOT NULL THEN
    INSERT INTO public.partner_preferences (student_id, age_min, age_max, preferred_countries, work_status, head_cover_type, plan_for_life, cellphone_type, about_partner, additional_information)
    SELECT
      new_student_id,
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
    SELECT
      new_student_id,
      (x->>'reference_type')::reference_type_enum,
      x->>'name',
      x->>'phone',
      x->>'email'
    FROM jsonb_array_elements(payload->'references') x;
  END IF;

  IF payload->'previous_partners' IS NOT NULL AND jsonb_array_length(payload->'previous_partners') > 0 THEN
    INSERT INTO public.previous_partners (student_id, separation_type, full_name, marriage_date, divorce_date, death_date, children_number, divorce_details)
    SELECT
      new_student_id,
      x->>'separation_type',
      x->>'full_name',
      (x->>'marriage_date')::date,
      (x->>'divorce_date')::date,
      (x->>'death_date')::date,
      (x->>'children_number')::int,
      x->'divorce_details'
    FROM jsonb_array_elements(payload->'previous_partners') x;
  END IF;

  RETURN new_student_id;
END;
$$;


ALTER FUNCTION "public"."create_full_student_profile"("payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_dm_room"("other_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  me uuid := auth.uid();
  a uuid;
  b uuid;
  rid uuid;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;

  if other_user_id is null or other_user_id = me then
    raise exception 'Invalid other_user_id';
  end if;

  select user_a, user_b into a, b
  from public.chat_canonical_pair(me, other_user_id);

  select room_id into rid
  from public.chat_rooms
  where user_a = a and user_b = b;

  if rid is not null then
    return rid;
  end if;

  insert into public.chat_rooms(user_a, user_b, created_by)
  values (a, b, me)
  returning room_id into rid;

  insert into public.chat_room_participants(room_id, user_id)
  values (rid, me), (rid, other_user_id);

  return rid;
end;
$$;


ALTER FUNCTION "public"."get_or_create_dm_room"("other_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_metadata"("target_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  profile_data JSONB;
BEGIN
  SELECT jsonb_build_object(
    'id', id,
    'firstName', first_name,
    'lastName', last_name,
    'email', email
  )
  INTO profile_data
  FROM public.user_profiles
  WHERE id = target_user_id;

  RETURN profile_data;
END;
$$;


ALTER FUNCTION "public"."get_user_metadata"("target_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_metadata"("target_user_id" "uuid") IS 'Returns user metadata (firstName, lastName, email) for a given user ID. Requires authentication and RLS policies apply.';



CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM auth.users
    WHERE id = auth.uid()
    AND (raw_user_meta_data->>'role')::text = 'admin'
  );
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_admin"() IS 'בודק אם המשתמש הנוכחי הוא admin';



CREATE OR REPLACE FUNCTION "public"."is_admin"("uid" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT COALESCE((raw_user_meta_data->>'role')::text = 'admin', false) FROM auth.users WHERE id = uid;
$$;


ALTER FUNCTION "public"."is_admin"("uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_approved_shadchan"("uid" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT EXISTS (SELECT 1 FROM shadchanim_info WHERE user_id = uid AND application_status = 'approved');
$$;


ALTER FUNCTION "public"."is_approved_shadchan"("uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_shadchan"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = auth.uid()
    AND (raw_user_meta_data->>'role')::text = 'shadchan'
  );
$$;


ALTER FUNCTION "public"."is_shadchan"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_shadchan_or_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
  SELECT public.is_admin() OR public.is_shadchan();
$$;


ALTER FUNCTION "public"."is_shadchan_or_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_user_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
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
  VALUES (
    NEW.id,
    fn,
    ln,
    NEW.email,
    NOW()
  )
  ON CONFLICT (id)
  DO UPDATE SET
    first_name = COALESCE(fn, user_profiles.first_name),
    last_name = COALESCE(ln, user_profiles.last_name),
    email = COALESCE(NEW.email, user_profiles.email),
    updated_at = NOW();

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_user_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_shadchanim_info_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_shadchanim_info_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_shidduchim_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_shidduchim_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_system_content_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_system_content_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_shidduch_genders"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  groom_gender gender_enum;
  bride_gender gender_enum;
BEGIN
  -- בדיקת מגדר החתן
  SELECT gender INTO groom_gender
  FROM public.students
  WHERE id = NEW.groom_id;
  
  IF groom_gender IS NULL THEN
    RAISE EXCEPTION 'Groom student not found';
  END IF;
  
  IF groom_gender != 'male' THEN
    RAISE EXCEPTION 'Groom must be male (groom_id cannot be a student with gender=female)';
  END IF;
  
  -- בדיקת מגדר הכלה
  SELECT gender INTO bride_gender
  FROM public.students
  WHERE id = NEW.bride_id;
  
  IF bride_gender IS NULL THEN
    RAISE EXCEPTION 'Bride student not found';
  END IF;
  
  IF bride_gender != 'female' THEN
    RAISE EXCEPTION 'Bride must be female (bride_id cannot be a student with gender=male)';
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_shidduch_genders"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."chat_messages" (
    "message_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "edited_at" timestamp with time zone,
    "reply_to_message_id" "uuid"
);


ALTER TABLE "public"."chat_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_room_participants" (
    "room_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_read_at" timestamp with time zone,
    "hidden_at" timestamp with time zone,
    "deleted_before" timestamp with time zone
);


ALTER TABLE "public"."chat_room_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_rooms" (
    "room_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_a" "uuid" NOT NULL,
    "user_b" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_message_id" "uuid",
    "last_message_at" timestamp with time zone,
    "created_by" "uuid" NOT NULL,
    CONSTRAINT "chat_rooms_users_distinct" CHECK (("user_a" <> "user_b")),
    CONSTRAINT "chat_rooms_users_ordered" CHECK (("user_a" < "user_b"))
);


ALTER TABLE "public"."chat_rooms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."education_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "institution_type" "public"."education_type_enum" NOT NULL,
    "name" "text",
    "community" "text",
    "city" "text"
);


ALTER TABLE "public"."education_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employment_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "category" "text",
    "role" "text",
    "location" "text",
    "description" "text"
);


ALTER TABLE "public"."employment_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."forum_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "slug" "text" NOT NULL,
    "icon" "text",
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."forum_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."forum_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "post_id" "uuid",
    "reply_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "one_target" CHECK (((("post_id" IS NOT NULL) AND ("reply_id" IS NULL)) OR (("post_id" IS NULL) AND ("reply_id" IS NOT NULL))))
);


ALTER TABLE "public"."forum_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."forum_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "author_id" "uuid" NOT NULL,
    "is_pinned" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "category_id" "uuid",
    "tags" "text"[] DEFAULT '{}'::"text"[]
);


ALTER TABLE "public"."forum_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."forum_replies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "author_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."forum_replies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."medical_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "status" "public"."medical_status_enum",
    "exposure_level" "text",
    "details" "text",
    "documents" "text"[],
    "contact_info" "jsonb",
    "related_issue_preference" "text",
    CONSTRAINT "medical_records_exposure_level_check" CHECK (("exposure_level" = ANY (ARRAY['no_exposure'::"text", 'basic_exposure'::"text", 'only_for_kol_mitzhalot'::"text", 'full_exposure'::"text"])))
);


ALTER TABLE "public"."medical_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."partner_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "age_min" integer,
    "age_max" integer,
    "preferred_countries" "text"[],
    "work_status" "text",
    "head_cover_type" "public"."head_cover_type_enum",
    "plan_for_life" "public"."plan_for_life_enum",
    "cellphone_type" "public"."cellphone_type_enum",
    "about_partner" "text",
    "additional_information" "text"
);


ALTER TABLE "public"."partner_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."previous_partners" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "separation_type" "text",
    "full_name" "text",
    "marriage_date" "date",
    "divorce_date" "date",
    "death_date" "date",
    "children_number" integer DEFAULT 0,
    "divorce_details" "jsonb"
);


ALTER TABLE "public"."previous_partners" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."references" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "reference_type" "public"."reference_type_enum" NOT NULL,
    "name" "text",
    "phone" "text",
    "email" "text"
);


ALTER TABLE "public"."references" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shadchanim_info" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "bio" "text",
    "experience_years" integer,
    "specializations" "text"[],
    "contact_phone" "text",
    "contact_email" "text",
    "website_url" "text",
    "location" "text",
    "languages" "text"[],
    "certifications" "text"[],
    "additional_info" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "application_status" "text",
    "submitted_at" timestamp with time zone,
    "approved_at" timestamp with time zone,
    "rejected_at" timestamp with time zone,
    "rejected_reason" "text",
    CONSTRAINT "shadchanim_info_application_status_check" CHECK (("application_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."shadchanim_info" OWNER TO "postgres";


COMMENT ON TABLE "public"."shadchanim_info" IS 'מידע נוסף על שדכנים - ביוגרפיה, ניסיון, התמחויות וכו';



COMMENT ON COLUMN "public"."shadchanim_info"."user_id" IS 'מזהה המשתמש (חייב להיות שדכן)';



COMMENT ON COLUMN "public"."shadchanim_info"."bio" IS 'ביוגרפיה של השדכן';



COMMENT ON COLUMN "public"."shadchanim_info"."experience_years" IS 'שנות ניסיון';



COMMENT ON COLUMN "public"."shadchanim_info"."specializations" IS 'התמחויות (מערך טקסט)';



COMMENT ON COLUMN "public"."shadchanim_info"."languages" IS 'שפות שהשדכן דובר';



COMMENT ON COLUMN "public"."shadchanim_info"."certifications" IS 'תעודות והסמכות';



COMMENT ON COLUMN "public"."shadchanim_info"."application_status" IS 'סטטוס הבקשה: pending (ממתין), approved (אושר), rejected (נדחה), או NULL (שדכן קיים)';



COMMENT ON COLUMN "public"."shadchanim_info"."submitted_at" IS 'תאריך הגשת הבקשה';



COMMENT ON COLUMN "public"."shadchanim_info"."approved_at" IS 'תאריך אישור הבקשה';



COMMENT ON COLUMN "public"."shadchanim_info"."rejected_at" IS 'תאריך דחיית הבקשה';



COMMENT ON COLUMN "public"."shadchanim_info"."rejected_reason" IS 'סיבת הדחייה (אם נדחה)';



CREATE TABLE IF NOT EXISTS "public"."shidduchim" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "groom_id" "uuid" NOT NULL,
    "bride_id" "uuid" NOT NULL,
    "shadchan_id" "uuid" NOT NULL,
    "status" "public"."shidduch_status_enum" DEFAULT 'draft'::"public"."shidduch_status_enum" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "note_for_groom" "text",
    "note_for_bride" "text",
    "recipient_scope" "text",
    "sent_at" timestamp with time zone,
    CONSTRAINT "shidduchim_recipient_scope_check" CHECK ((("recipient_scope" IS NULL) OR ("recipient_scope" = ANY (ARRAY['both'::"text", 'groom_only'::"text", 'bride_only'::"text"]))))
);


ALTER TABLE "public"."shidduchim" OWNER TO "postgres";


COMMENT ON TABLE "public"."shidduchim" IS 'טבלת שידוכים - מכילה את כל השידוכים במערכת';



COMMENT ON COLUMN "public"."shidduchim"."groom_id" IS 'מזהה החתן (חייב להיות student עם gender=male)';



COMMENT ON COLUMN "public"."shidduchim"."bride_id" IS 'מזהה הכלה (חייב להיות student עם gender=female)';



COMMENT ON COLUMN "public"."shidduchim"."shadchan_id" IS 'מזהה השדכן (המשתמש שיצר את השידוך)';



COMMENT ON COLUMN "public"."shidduchim"."status" IS 'סטטוס השידוך: pending, approved, rejected, in_progress, completed, cancelled';



COMMENT ON COLUMN "public"."shidduchim"."note_for_groom" IS 'הערת השדכן שתישלח/תוצג לצד המיועד';



COMMENT ON COLUMN "public"."shidduchim"."note_for_bride" IS 'הערת השדכן שתישלח/תוצג לצד המיועדת';



COMMENT ON COLUMN "public"."shidduchim"."recipient_scope" IS 'למי נשלחה ההצעה: both | groom_only | bride_only';



COMMENT ON COLUMN "public"."shidduchim"."sent_at" IS 'מתי נשלחה ההצעה במייל (NULL = טיוטה או לא נשלחו)';



CREATE TABLE IF NOT EXISTS "public"."students" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "identity_number" "text",
    "birth_date" "date" NOT NULL,
    "gender" "public"."gender_enum" NOT NULL,
    "personal_status" "public"."personal_status_enum" NOT NULL,
    "height" numeric,
    "phone" "text",
    "country" "text" NOT NULL,
    "city" "text" NOT NULL,
    "street" "text",
    "house" "text",
    "community" "text",
    "shtible" "text",
    "cellphone_type" "public"."cellphone_type_enum",
    "plan_for_life" "public"."plan_for_life_enum",
    "head_cover_type" "public"."head_cover_type_enum",
    "image_url" "text",
    "cv_url" "text",
    "about" "text",
    "parents_info" "jsonb" DEFAULT '{}'::"jsonb",
    "family_info" "jsonb" DEFAULT '{}'::"jsonb",
    "author_info" "jsonb" DEFAULT '{}'::"jsonb",
    "in_shidduchim" boolean
);


ALTER TABLE "public"."students" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_content" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."system_content" OWNER TO "postgres";


COMMENT ON TABLE "public"."system_content" IS 'טבלת תוכן מערכת - מכילה תוכן כמו מדיניות פרטיות, תנאי שימוש וכו';



COMMENT ON COLUMN "public"."system_content"."key" IS 'מפתח ייחודי לזיהוי התוכן (לדוגמה: privacy_policy, terms_of_service)';



COMMENT ON COLUMN "public"."system_content"."title" IS 'כותרת התוכן';



COMMENT ON COLUMN "public"."system_content"."content" IS 'תוכן HTML/מעוצב';



CREATE TABLE IF NOT EXISTS "public"."system_settings" (
    "key" "text" NOT NULL,
    "value" boolean NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."system_settings" OWNER TO "postgres";


COMMENT ON TABLE "public"."system_settings" IS 'הגדרות מערכת כלליות (דגלים) — ניתן להרחבה לפי מפתח';



CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "email" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_profiles" IS 'User profiles synced from auth.users metadata';



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("message_id");



ALTER TABLE ONLY "public"."chat_room_participants"
    ADD CONSTRAINT "chat_room_participants_pkey" PRIMARY KEY ("room_id", "user_id");



ALTER TABLE ONLY "public"."chat_rooms"
    ADD CONSTRAINT "chat_rooms_pkey" PRIMARY KEY ("room_id");



ALTER TABLE ONLY "public"."education_history"
    ADD CONSTRAINT "education_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employment_history"
    ADD CONSTRAINT "employment_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."forum_categories"
    ADD CONSTRAINT "forum_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."forum_categories"
    ADD CONSTRAINT "forum_categories_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."forum_likes"
    ADD CONSTRAINT "forum_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."forum_likes"
    ADD CONSTRAINT "forum_likes_user_id_post_id_key" UNIQUE ("user_id", "post_id");



ALTER TABLE ONLY "public"."forum_likes"
    ADD CONSTRAINT "forum_likes_user_id_reply_id_key" UNIQUE ("user_id", "reply_id");



ALTER TABLE ONLY "public"."forum_posts"
    ADD CONSTRAINT "forum_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."forum_replies"
    ADD CONSTRAINT "forum_replies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."medical_records"
    ADD CONSTRAINT "medical_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."medical_records"
    ADD CONSTRAINT "medical_records_student_id_key" UNIQUE ("student_id");



ALTER TABLE ONLY "public"."partner_preferences"
    ADD CONSTRAINT "partner_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."partner_preferences"
    ADD CONSTRAINT "partner_preferences_student_id_key" UNIQUE ("student_id");



ALTER TABLE ONLY "public"."previous_partners"
    ADD CONSTRAINT "previous_partners_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."references"
    ADD CONSTRAINT "references_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shadchanim_info"
    ADD CONSTRAINT "shadchanim_info_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shadchanim_info"
    ADD CONSTRAINT "shadchanim_info_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."shidduchim"
    ADD CONSTRAINT "shidduchim_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_identity_number_key" UNIQUE ("identity_number");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_content"
    ADD CONSTRAINT "system_content_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."system_content"
    ADD CONSTRAINT "system_content_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."shidduchim"
    ADD CONSTRAINT "unique_shidduch_pair" UNIQUE ("groom_id", "bride_id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



CREATE INDEX "chat_messages_room_created_at_idx" ON "public"."chat_messages" USING "btree" ("room_id", "created_at" DESC);



CREATE INDEX "chat_room_participants_room_idx" ON "public"."chat_room_participants" USING "btree" ("room_id");



CREATE INDEX "chat_room_participants_user_idx" ON "public"."chat_room_participants" USING "btree" ("user_id");



CREATE UNIQUE INDEX "chat_rooms_unique_pair_idx" ON "public"."chat_rooms" USING "btree" ("user_a", "user_b");



CREATE INDEX "forum_posts_category_id_idx" ON "public"."forum_posts" USING "btree" ("category_id");



CREATE INDEX "idx_chat_messages_reply_to_message_id" ON "public"."chat_messages" USING "btree" ("reply_to_message_id");



CREATE INDEX "idx_chat_messages_sender_id" ON "public"."chat_messages" USING "btree" ("sender_id");



CREATE INDEX "idx_chat_rooms_created_by" ON "public"."chat_rooms" USING "btree" ("created_by");



CREATE INDEX "idx_chat_rooms_last_message_id" ON "public"."chat_rooms" USING "btree" ("last_message_id");



CREATE INDEX "idx_chat_rooms_user_b" ON "public"."chat_rooms" USING "btree" ("user_b");



CREATE INDEX "idx_education_history_student_id" ON "public"."education_history" USING "btree" ("student_id");



CREATE INDEX "idx_employment_history_student_id" ON "public"."employment_history" USING "btree" ("student_id");



CREATE INDEX "idx_previous_partners_student_id" ON "public"."previous_partners" USING "btree" ("student_id");



CREATE INDEX "idx_references_student_id" ON "public"."references" USING "btree" ("student_id");



CREATE INDEX "idx_shadchanim_info_user_id" ON "public"."shadchanim_info" USING "btree" ("user_id");



CREATE INDEX "idx_shidduchim_bride_id" ON "public"."shidduchim" USING "btree" ("bride_id");



CREATE INDEX "idx_shidduchim_groom_id" ON "public"."shidduchim" USING "btree" ("groom_id");



CREATE INDEX "idx_shidduchim_shadchan_id" ON "public"."shidduchim" USING "btree" ("shadchan_id");



CREATE INDEX "idx_system_content_key" ON "public"."system_content" USING "btree" ("key");



CREATE INDEX "students_user_id_idx" ON "public"."students" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "trg_chat_rooms_set_last_message" AFTER INSERT ON "public"."chat_messages" FOR EACH ROW EXECUTE FUNCTION "public"."chat_rooms_set_last_message"();



CREATE OR REPLACE TRIGGER "trigger_update_shadchanim_info_updated_at" BEFORE UPDATE ON "public"."shadchanim_info" FOR EACH ROW EXECUTE FUNCTION "public"."update_shadchanim_info_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_shidduchim_updated_at" BEFORE UPDATE ON "public"."shidduchim" FOR EACH ROW EXECUTE FUNCTION "public"."update_shidduchim_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_system_content_updated_at" BEFORE UPDATE ON "public"."system_content" FOR EACH ROW EXECUTE FUNCTION "public"."update_system_content_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_validate_shidduch_genders" BEFORE INSERT OR UPDATE ON "public"."shidduchim" FOR EACH ROW EXECUTE FUNCTION "public"."validate_shidduch_genders"();



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_reply_fk" FOREIGN KEY ("reply_to_message_id") REFERENCES "public"."chat_messages"("message_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."chat_rooms"("room_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_room_participants"
    ADD CONSTRAINT "chat_room_participants_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."chat_rooms"("room_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_room_participants"
    ADD CONSTRAINT "chat_room_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_rooms"
    ADD CONSTRAINT "chat_rooms_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_rooms"
    ADD CONSTRAINT "chat_rooms_last_message_fk" FOREIGN KEY ("last_message_id") REFERENCES "public"."chat_messages"("message_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."chat_rooms"
    ADD CONSTRAINT "chat_rooms_user_a_fkey" FOREIGN KEY ("user_a") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_rooms"
    ADD CONSTRAINT "chat_rooms_user_b_fkey" FOREIGN KEY ("user_b") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."education_history"
    ADD CONSTRAINT "education_history_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employment_history"
    ADD CONSTRAINT "employment_history_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."forum_likes"
    ADD CONSTRAINT "forum_likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."forum_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."forum_likes"
    ADD CONSTRAINT "forum_likes_reply_id_fkey" FOREIGN KEY ("reply_id") REFERENCES "public"."forum_replies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."forum_likes"
    ADD CONSTRAINT "forum_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."forum_posts"
    ADD CONSTRAINT "forum_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."forum_posts"
    ADD CONSTRAINT "forum_posts_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."forum_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."forum_replies"
    ADD CONSTRAINT "forum_replies_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."forum_replies"
    ADD CONSTRAINT "forum_replies_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."forum_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."medical_records"
    ADD CONSTRAINT "medical_records_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."partner_preferences"
    ADD CONSTRAINT "partner_preferences_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."previous_partners"
    ADD CONSTRAINT "previous_partners_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."references"
    ADD CONSTRAINT "references_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shadchanim_info"
    ADD CONSTRAINT "shadchanim_info_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shidduchim"
    ADD CONSTRAINT "shidduchim_bride_id_fkey" FOREIGN KEY ("bride_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shidduchim"
    ADD CONSTRAINT "shidduchim_groom_id_fkey" FOREIGN KEY ("groom_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shidduchim"
    ADD CONSTRAINT "shidduchim_shadchan_id_fkey" FOREIGN KEY ("shadchan_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can view all shidduchim" ON "public"."shidduchim" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "Anyone can read system content" ON "public"."system_content" FOR SELECT USING (true);



CREATE POLICY "Only admins can delete system content" ON "public"."system_content" FOR DELETE USING (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Only admins can modify system content" ON "public"."system_content" FOR INSERT WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Only admins can update system content" ON "public"."system_content" FOR UPDATE USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Parents can view shidduchim involving their students" ON "public"."shidduchim" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."students" "s"
  WHERE (("s"."id" = "shidduchim"."groom_id") AND ("s"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR (EXISTS ( SELECT 1
   FROM "public"."students" "s"
  WHERE (("s"."id" = "shidduchim"."bride_id") AND ("s"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



COMMENT ON POLICY "Parents can view shidduchim involving their students" ON "public"."shidduchim" IS 'מאפשר למנהל הכרטיס (user_id) של המיועד או המיועדת לראות את רשומת השידוך — לדוגמה מקישור במייל';



CREATE POLICY "Shadchanim_info delete admin only" ON "public"."shadchanim_info" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "Shadchanim_info insert own or admin" ON "public"."shadchanim_info" FOR INSERT WITH CHECK (("public"."is_admin"() OR ("auth"."uid"() = "user_id")));



CREATE POLICY "Shadchanim_info select own or admin" ON "public"."shadchanim_info" FOR SELECT USING (("public"."is_admin"() OR ("auth"."uid"() = "user_id")));



CREATE POLICY "Shadchanim_info update own or admin" ON "public"."shadchanim_info" FOR UPDATE USING (("public"."is_admin"() OR ("auth"."uid"() = "user_id"))) WITH CHECK (("public"."is_admin"() OR ("auth"."uid"() = "user_id")));



CREATE POLICY "Users can create shidduchim" ON "public"."shidduchim" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "shadchan_id"));



CREATE POLICY "Users can delete their own shidduchim" ON "public"."shidduchim" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "shadchan_id"));



CREATE POLICY "Users can insert education history for their students" ON "public"."education_history" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."students"
  WHERE (("students"."id" = "education_history"."student_id") AND ("students"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can insert employment history for their students" ON "public"."employment_history" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."students"
  WHERE (("students"."id" = "employment_history"."student_id") AND ("students"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can insert medical records for their students" ON "public"."medical_records" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."students"
  WHERE (("students"."id" = "medical_records"."student_id") AND ("students"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can insert partner preferences for their students" ON "public"."partner_preferences" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."students"
  WHERE (("students"."id" = "partner_preferences"."student_id") AND ("students"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can insert previous partners for their students" ON "public"."previous_partners" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."students"
  WHERE (("students"."id" = "previous_partners"."student_id") AND ("students"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can insert references for their students" ON "public"."references" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."students"
  WHERE (("students"."id" = "references"."student_id") AND ("students"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can insert their own profile" ON "public"."students" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can read profiles of users they chat with" ON "public"."user_profiles" FOR SELECT TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "id") OR (EXISTS ( SELECT 1
   FROM ("public"."chat_room_participants" "crp1"
     JOIN "public"."chat_room_participants" "crp2" ON (("crp1"."room_id" = "crp2"."room_id")))
  WHERE (("crp1"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("crp2"."user_id" = "user_profiles"."id") AND ("crp1"."deleted_before" IS NULL) AND ("crp2"."deleted_before" IS NULL))))));



CREATE POLICY "Users can update medical records for their students" ON "public"."medical_records" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."students"
  WHERE (("students"."id" = "medical_records"."student_id") AND ("students"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."students"
  WHERE (("students"."id" = "medical_records"."student_id") AND ("students"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can update their own profile" ON "public"."students" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update their own shidduchim" ON "public"."shidduchim" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "shadchan_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "shadchan_id"));



CREATE POLICY "Users can view own profile or shadchanim see all" ON "public"."students" FOR SELECT USING ((("auth"."uid"() = "user_id") OR "public"."is_shadchan_or_admin"()));



CREATE POLICY "Users can view their own shidduchim as shadchan" ON "public"."shidduchim" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "shadchan_id"));



CREATE POLICY "Users read own students or shadchanim see all" ON "public"."education_history" FOR SELECT USING (("public"."is_shadchan_or_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."students"
  WHERE (("students"."id" = "education_history"."student_id") AND ("students"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users read own students or shadchanim see all" ON "public"."employment_history" FOR SELECT USING (("public"."is_shadchan_or_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."students"
  WHERE (("students"."id" = "employment_history"."student_id") AND ("students"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users read own students or shadchanim see all" ON "public"."medical_records" FOR SELECT USING (("public"."is_shadchan_or_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."students"
  WHERE (("students"."id" = "medical_records"."student_id") AND ("students"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users read own students or shadchanim see all" ON "public"."partner_preferences" FOR SELECT USING (("public"."is_shadchan_or_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."students"
  WHERE (("students"."id" = "partner_preferences"."student_id") AND ("students"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users read own students or shadchanim see all" ON "public"."previous_partners" FOR SELECT USING (("public"."is_shadchan_or_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."students"
  WHERE (("students"."id" = "previous_partners"."student_id") AND ("students"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users read own students or shadchanim see all" ON "public"."references" FOR SELECT USING (("public"."is_shadchan_or_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."students"
  WHERE (("students"."id" = "references"."student_id") AND ("students"."user_id" = "auth"."uid"()))))));



CREATE POLICY "categories_delete" ON "public"."forum_categories" FOR DELETE TO "authenticated" USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "categories_insert" ON "public"."forum_categories" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "categories_select" ON "public"."forum_categories" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "categories_update" ON "public"."forum_categories" FOR UPDATE TO "authenticated" USING ("public"."is_admin"("auth"."uid"()));



ALTER TABLE "public"."chat_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chat_messages_update_own_within_7m" ON "public"."chat_messages" FOR UPDATE TO "authenticated" USING ((("sender_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("created_at" > ("now"() - '00:07:00'::interval)))) WITH CHECK ((("sender_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("created_at" > ("now"() - '00:07:00'::interval))));



ALTER TABLE "public"."chat_room_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_rooms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."education_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employment_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."forum_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."forum_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."forum_posts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "forum_posts_delete" ON "public"."forum_posts" FOR DELETE TO "authenticated" USING ((("author_id" = "auth"."uid"()) OR "public"."is_admin"("auth"."uid"())));



CREATE POLICY "forum_posts_insert" ON "public"."forum_posts" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_approved_shadchan"("auth"."uid"()) OR "public"."is_admin"("auth"."uid"())));



CREATE POLICY "forum_posts_select" ON "public"."forum_posts" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "forum_posts_update" ON "public"."forum_posts" FOR UPDATE TO "authenticated" USING (("author_id" = "auth"."uid"()));



ALTER TABLE "public"."forum_replies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "forum_replies_delete" ON "public"."forum_replies" FOR DELETE TO "authenticated" USING ((("author_id" = "auth"."uid"()) OR "public"."is_admin"("auth"."uid"())));



CREATE POLICY "forum_replies_insert" ON "public"."forum_replies" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_approved_shadchan"("auth"."uid"()) OR "public"."is_admin"("auth"."uid"())));



CREATE POLICY "forum_replies_select" ON "public"."forum_replies" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "forum_replies_update" ON "public"."forum_replies" FOR UPDATE TO "authenticated" USING (("author_id" = "auth"."uid"()));



CREATE POLICY "likes_delete" ON "public"."forum_likes" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "likes_insert" ON "public"."forum_likes" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_approved_shadchan"("auth"."uid"()) OR "public"."is_admin"("auth"."uid"())));



CREATE POLICY "likes_select" ON "public"."forum_likes" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."medical_records" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "messages_insert_sender_is_participant" ON "public"."chat_messages" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "sender_id") AND (EXISTS ( SELECT 1
   FROM "public"."chat_room_participants" "p"
  WHERE (("p"."room_id" = "chat_messages"."room_id") AND ("p"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "messages_no_delete" ON "public"."chat_messages" FOR DELETE TO "authenticated" USING (false);



CREATE POLICY "messages_select_participants" ON "public"."chat_messages" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."chat_room_participants" "p"
  WHERE (("p"."room_id" = "chat_messages"."room_id") AND ("p"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("p"."deleted_before" IS NULL) OR ("chat_messages"."created_at" > "p"."deleted_before")) AND ("p"."hidden_at" IS NULL)))));



CREATE POLICY "participants_insert_room_creator" ON "public"."chat_room_participants" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."chat_rooms" "r"
  WHERE (("r"."room_id" = "chat_room_participants"."room_id") AND ("r"."created_by" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "participants_no_delete" ON "public"."chat_room_participants" FOR DELETE TO "authenticated" USING (false);



CREATE POLICY "participants_select_in_my_rooms" ON "public"."chat_room_participants" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."chat_rooms" "r"
  WHERE (("r"."room_id" = "chat_room_participants"."room_id") AND ((( SELECT "auth"."uid"() AS "uid") = "r"."user_a") OR (( SELECT "auth"."uid"() AS "uid") = "r"."user_b"))))));



CREATE POLICY "participants_update_self_only" ON "public"."chat_room_participants" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."partner_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."previous_partners" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."references" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rooms_insert_creator_canonical" ON "public"."chat_rooms" FOR INSERT TO "authenticated" WITH CHECK ((("created_by" = ( SELECT "auth"."uid"() AS "uid")) AND ("user_a" < "user_b") AND ("user_a" <> "user_b") AND ((( SELECT "auth"."uid"() AS "uid") = "user_a") OR (( SELECT "auth"."uid"() AS "uid") = "user_b"))));



CREATE POLICY "rooms_no_client_update" ON "public"."chat_rooms" FOR UPDATE TO "authenticated" USING (false) WITH CHECK (false);



CREATE POLICY "rooms_select_participants" ON "public"."chat_rooms" FOR SELECT TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "user_a") OR (( SELECT "auth"."uid"() AS "uid") = "user_b")));



ALTER TABLE "public"."shadchanim_info" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shidduchim" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."students" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."system_content" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."system_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "system_settings_select_authenticated" ON "public"."system_settings" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."chat_messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."chat_rooms";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."chat_canonical_pair"("u1" "uuid", "u2" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."chat_canonical_pair"("u1" "uuid", "u2" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."chat_canonical_pair"("u1" "uuid", "u2" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."chat_rooms_set_last_message"() TO "anon";
GRANT ALL ON FUNCTION "public"."chat_rooms_set_last_message"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."chat_rooms_set_last_message"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_full_student_profile"("payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_full_student_profile"("payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_full_student_profile"("payload" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_or_create_dm_room"("other_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_or_create_dm_room"("other_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_dm_room"("other_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_metadata"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_metadata"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_metadata"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"("uid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"("uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"("uid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_approved_shadchan"("uid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_approved_shadchan"("uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_approved_shadchan"("uid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_shadchan"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_shadchan"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_shadchan"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_shadchan_or_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_shadchan_or_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_shadchan_or_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_user_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_user_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_user_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_shadchanim_info_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_shadchanim_info_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_shadchanim_info_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_shidduchim_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_shidduchim_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_shidduchim_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_system_content_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_system_content_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_system_content_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_shidduch_genders"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_shidduch_genders"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_shidduch_genders"() TO "service_role";


















GRANT ALL ON TABLE "public"."chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_messages" TO "service_role";



GRANT ALL ON TABLE "public"."chat_room_participants" TO "anon";
GRANT ALL ON TABLE "public"."chat_room_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_room_participants" TO "service_role";



GRANT ALL ON TABLE "public"."chat_rooms" TO "anon";
GRANT ALL ON TABLE "public"."chat_rooms" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_rooms" TO "service_role";



GRANT ALL ON TABLE "public"."education_history" TO "anon";
GRANT ALL ON TABLE "public"."education_history" TO "authenticated";
GRANT ALL ON TABLE "public"."education_history" TO "service_role";



GRANT ALL ON TABLE "public"."employment_history" TO "anon";
GRANT ALL ON TABLE "public"."employment_history" TO "authenticated";
GRANT ALL ON TABLE "public"."employment_history" TO "service_role";



GRANT ALL ON TABLE "public"."forum_categories" TO "anon";
GRANT ALL ON TABLE "public"."forum_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."forum_categories" TO "service_role";



GRANT ALL ON TABLE "public"."forum_likes" TO "anon";
GRANT ALL ON TABLE "public"."forum_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."forum_likes" TO "service_role";



GRANT ALL ON TABLE "public"."forum_posts" TO "anon";
GRANT ALL ON TABLE "public"."forum_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."forum_posts" TO "service_role";



GRANT ALL ON TABLE "public"."forum_replies" TO "anon";
GRANT ALL ON TABLE "public"."forum_replies" TO "authenticated";
GRANT ALL ON TABLE "public"."forum_replies" TO "service_role";



GRANT ALL ON TABLE "public"."medical_records" TO "anon";
GRANT ALL ON TABLE "public"."medical_records" TO "authenticated";
GRANT ALL ON TABLE "public"."medical_records" TO "service_role";



GRANT ALL ON TABLE "public"."partner_preferences" TO "anon";
GRANT ALL ON TABLE "public"."partner_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."partner_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."previous_partners" TO "anon";
GRANT ALL ON TABLE "public"."previous_partners" TO "authenticated";
GRANT ALL ON TABLE "public"."previous_partners" TO "service_role";



GRANT ALL ON TABLE "public"."references" TO "anon";
GRANT ALL ON TABLE "public"."references" TO "authenticated";
GRANT ALL ON TABLE "public"."references" TO "service_role";



GRANT ALL ON TABLE "public"."shadchanim_info" TO "anon";
GRANT ALL ON TABLE "public"."shadchanim_info" TO "authenticated";
GRANT ALL ON TABLE "public"."shadchanim_info" TO "service_role";



GRANT ALL ON TABLE "public"."shidduchim" TO "anon";
GRANT ALL ON TABLE "public"."shidduchim" TO "authenticated";
GRANT ALL ON TABLE "public"."shidduchim" TO "service_role";



GRANT ALL ON TABLE "public"."students" TO "anon";
GRANT ALL ON TABLE "public"."students" TO "authenticated";
GRANT ALL ON TABLE "public"."students" TO "service_role";



GRANT ALL ON TABLE "public"."system_content" TO "anon";
GRANT ALL ON TABLE "public"."system_content" TO "authenticated";
GRANT ALL ON TABLE "public"."system_content" TO "service_role";



GRANT ALL ON TABLE "public"."system_settings" TO "anon";
GRANT ALL ON TABLE "public"."system_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."system_settings" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































