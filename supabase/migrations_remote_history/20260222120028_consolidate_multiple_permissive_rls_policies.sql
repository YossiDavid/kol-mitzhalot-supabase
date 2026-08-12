
-- =============================================================================
-- Consolidate multiple permissive RLS policies into one per (table, role, action)
-- by OR-ing the conditions. Preserves exact same access semantics.
-- =============================================================================

-- --- chat_messages (authenticated, UPDATE): keep only the 7m policy; drop the no-update one ---
-- messages_no_update has USING false so it never allows; the 7m policy is the only one that grants access.
DROP POLICY IF EXISTS "messages_no_update" ON public.chat_messages;

-- --- students (authenticated, SELECT): one policy = Shadchanim see all OR own profile ---
DROP POLICY IF EXISTS "Shadchanim can see all data" ON public.students;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.students;
CREATE POLICY "Users can view own profile or shadchanim see all" ON public.students FOR SELECT TO public
  USING (
    ( (select auth.uid()) = user_id )
    OR ( ((select auth.jwt()) -> 'user_metadata') ->> 'role' = ANY (ARRAY['shadchan', 'admin']) )
  );

-- --- education_history (authenticated, SELECT) ---
DROP POLICY IF EXISTS "Shadchanim can see all data" ON public.education_history;
DROP POLICY IF EXISTS "Users can read education history for their students" ON public.education_history;
CREATE POLICY "Users read own students or shadchanim see all" ON public.education_history FOR SELECT TO public
  USING (
    ( ((select auth.jwt()) -> 'user_metadata') ->> 'role' = ANY (ARRAY['shadchan', 'admin']) )
    OR ( EXISTS ( SELECT 1 FROM students WHERE students.id = education_history.student_id AND students.user_id = (select auth.uid()) ) )
  );

-- --- employment_history (authenticated, SELECT) ---
DROP POLICY IF EXISTS "Shadchanim can see all data" ON public.employment_history;
DROP POLICY IF EXISTS "Users can read employment history for their students" ON public.employment_history;
CREATE POLICY "Users read own students or shadchanim see all" ON public.employment_history FOR SELECT TO public
  USING (
    ( ((select auth.jwt()) -> 'user_metadata') ->> 'role' = ANY (ARRAY['shadchan', 'admin']) )
    OR ( EXISTS ( SELECT 1 FROM students WHERE students.id = employment_history.student_id AND students.user_id = (select auth.uid()) ) )
  );

-- --- medical_records (authenticated, SELECT) ---
DROP POLICY IF EXISTS "Shadchanim can see all data" ON public.medical_records;
DROP POLICY IF EXISTS "Users can read medical records for their students" ON public.medical_records;
CREATE POLICY "Users read own students or shadchanim see all" ON public.medical_records FOR SELECT TO public
  USING (
    ( ((select auth.jwt()) -> 'user_metadata') ->> 'role' = ANY (ARRAY['shadchan', 'admin']) )
    OR ( EXISTS ( SELECT 1 FROM students WHERE students.id = medical_records.student_id AND students.user_id = (select auth.uid()) ) )
  );

-- --- partner_preferences (authenticated, SELECT) ---
DROP POLICY IF EXISTS "Shadchanim can see all data" ON public.partner_preferences;
DROP POLICY IF EXISTS "Users can read partner preferences for their students" ON public.partner_preferences;
CREATE POLICY "Users read own students or shadchanim see all" ON public.partner_preferences FOR SELECT TO public
  USING (
    ( ((select auth.jwt()) -> 'user_metadata') ->> 'role' = ANY (ARRAY['shadchan', 'admin']) )
    OR ( EXISTS ( SELECT 1 FROM students WHERE students.id = partner_preferences.student_id AND students.user_id = (select auth.uid()) ) )
  );

-- --- previous_partners (authenticated, SELECT) ---
DROP POLICY IF EXISTS "Shadchanim can see all data" ON public.previous_partners;
DROP POLICY IF EXISTS "Users can read previous partners for their students" ON public.previous_partners;
CREATE POLICY "Users read own students or shadchanim see all" ON public.previous_partners FOR SELECT TO public
  USING (
    ( ((select auth.jwt()) -> 'user_metadata') ->> 'role' = ANY (ARRAY['shadchan', 'admin']) )
    OR ( EXISTS ( SELECT 1 FROM students WHERE students.id = previous_partners.student_id AND students.user_id = (select auth.uid()) ) )
  );

-- --- references (authenticated, SELECT) ---
DROP POLICY IF EXISTS "Shadchanim can see all data" ON public.references;
DROP POLICY IF EXISTS "Users can read references for their students" ON public.references;
CREATE POLICY "Users read own students or shadchanim see all" ON public.references FOR SELECT TO public
  USING (
    ( ((select auth.jwt()) -> 'user_metadata') ->> 'role' = ANY (ARRAY['shadchan', 'admin']) )
    OR ( EXISTS ( SELECT 1 FROM students WHERE students.id = public.references.student_id AND students.user_id = (select auth.uid()) ) )
  );

-- --- shadchanim_info: one policy per command (SELECT, INSERT, UPDATE); ALL split so no duplicate SELECT ---
DROP POLICY IF EXISTS "Admins can manage all shadchanim info" ON public.shadchanim_info;
DROP POLICY IF EXISTS "Admins can view all shadchanim info" ON public.shadchanim_info;
DROP POLICY IF EXISTS "Shadchanim can view their own info" ON public.shadchanim_info;
DROP POLICY IF EXISTS "Shadchanim can insert their own info" ON public.shadchanim_info;
DROP POLICY IF EXISTS "Shadchanim can update their own info" ON public.shadchanim_info;

CREATE POLICY "Shadchanim_info select own or admin" ON public.shadchanim_info FOR SELECT TO public
  USING (
    ( ((select auth.jwt()) -> 'user_metadata') ->> 'role' = 'admin' )
    OR ( (select auth.uid()) = user_id )
  );

CREATE POLICY "Shadchanim_info insert own or admin" ON public.shadchanim_info FOR INSERT TO public
  WITH CHECK (
    ( ((select auth.jwt()) -> 'user_metadata') ->> 'role' = 'admin' )
    OR ( (select auth.uid()) = user_id )
  );

CREATE POLICY "Shadchanim_info update own or admin" ON public.shadchanim_info FOR UPDATE TO public
  USING (
    ( ((select auth.jwt()) -> 'user_metadata') ->> 'role' = 'admin' )
    OR ( (select auth.uid()) = user_id )
  )
  WITH CHECK (
    ( ((select auth.jwt()) -> 'user_metadata') ->> 'role' = 'admin' )
    OR ( (select auth.uid()) = user_id )
  );

CREATE POLICY "Shadchanim_info delete admin only" ON public.shadchanim_info FOR DELETE TO public
  USING ( ((select auth.jwt()) -> 'user_metadata') ->> 'role' = 'admin' );

-- --- system_content: SELECT has two policies (anyone read + admins manage). Keep one SELECT (true); restrict "admins manage" to INSERT/UPDATE/DELETE only ---
DROP POLICY IF EXISTS "Only admins can manage system content" ON public.system_content;

CREATE POLICY "Only admins can modify system content" ON public.system_content FOR INSERT TO public
  WITH CHECK ( (select is_admin()) );

CREATE POLICY "Only admins can update system content" ON public.system_content FOR UPDATE TO public
  USING ( (select is_admin()) )
  WITH CHECK ( (select is_admin()) );

CREATE POLICY "Only admins can delete system content" ON public.system_content FOR DELETE TO public
  USING ( (select is_admin()) );
;
