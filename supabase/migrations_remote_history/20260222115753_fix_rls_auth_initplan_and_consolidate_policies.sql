
-- =============================================================================
-- Fix auth_rls_initplan: wrap auth.uid() and auth.jwt() in (select ...)
-- so they are evaluated once per query (initPlan) instead of per row.
-- =============================================================================

-- --- students ---
DROP POLICY IF EXISTS "Users can view their own profile" ON public.students;
CREATE POLICY "Users can view their own profile" ON public.students FOR SELECT TO public
  USING ( (select auth.uid()) = user_id );

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.students;
CREATE POLICY "Users can insert their own profile" ON public.students FOR INSERT TO public
  WITH CHECK ( (select auth.uid()) = user_id );

DROP POLICY IF EXISTS "Users can update their own profile" ON public.students;
CREATE POLICY "Users can update their own profile" ON public.students FOR UPDATE TO public
  USING ( (select auth.uid()) = user_id );

DROP POLICY IF EXISTS "Shadchanim can see all data" ON public.students;
CREATE POLICY "Shadchanim can see all data" ON public.students FOR SELECT TO authenticated
  USING ( ((select auth.jwt()) -> 'user_metadata') ->> 'role' = ANY (ARRAY['shadchan', 'admin']) );

-- --- education_history ---
DROP POLICY IF EXISTS "Users can insert education history for their students" ON public.education_history;
CREATE POLICY "Users can insert education history for their students" ON public.education_history FOR INSERT TO authenticated
  WITH CHECK ( EXISTS ( SELECT 1 FROM students WHERE students.id = education_history.student_id AND students.user_id = (select auth.uid()) ) );

DROP POLICY IF EXISTS "Users can read education history for their students" ON public.education_history;
CREATE POLICY "Users can read education history for their students" ON public.education_history FOR SELECT TO authenticated
  USING ( EXISTS ( SELECT 1 FROM students WHERE students.id = education_history.student_id AND students.user_id = (select auth.uid()) ) );

DROP POLICY IF EXISTS "Shadchanim can see all data" ON public.education_history;
CREATE POLICY "Shadchanim can see all data" ON public.education_history FOR SELECT TO public
  USING ( ((select auth.jwt()) -> 'user_metadata') ->> 'role' = ANY (ARRAY['shadchan', 'admin']) );

-- --- employment_history ---
DROP POLICY IF EXISTS "Users can insert employment history for their students" ON public.employment_history;
CREATE POLICY "Users can insert employment history for their students" ON public.employment_history FOR INSERT TO authenticated
  WITH CHECK ( EXISTS ( SELECT 1 FROM students WHERE students.id = employment_history.student_id AND students.user_id = (select auth.uid()) ) );

DROP POLICY IF EXISTS "Users can read employment history for their students" ON public.employment_history;
CREATE POLICY "Users can read employment history for their students" ON public.employment_history FOR SELECT TO authenticated
  USING ( EXISTS ( SELECT 1 FROM students WHERE students.id = employment_history.student_id AND students.user_id = (select auth.uid()) ) );

DROP POLICY IF EXISTS "Shadchanim can see all data" ON public.employment_history;
CREATE POLICY "Shadchanim can see all data" ON public.employment_history FOR SELECT TO public
  USING ( ((select auth.jwt()) -> 'user_metadata') ->> 'role' = ANY (ARRAY['shadchan', 'admin']) );

-- --- medical_records ---
DROP POLICY IF EXISTS "Users can insert medical records for their students" ON public.medical_records;
CREATE POLICY "Users can insert medical records for their students" ON public.medical_records FOR INSERT TO authenticated
  WITH CHECK ( EXISTS ( SELECT 1 FROM students WHERE students.id = medical_records.student_id AND students.user_id = (select auth.uid()) ) );

DROP POLICY IF EXISTS "Users can read medical records for their students" ON public.medical_records;
CREATE POLICY "Users can read medical records for their students" ON public.medical_records FOR SELECT TO authenticated
  USING ( EXISTS ( SELECT 1 FROM students WHERE students.id = medical_records.student_id AND students.user_id = (select auth.uid()) ) );

DROP POLICY IF EXISTS "Users can update medical records for their students" ON public.medical_records;
CREATE POLICY "Users can update medical records for their students" ON public.medical_records FOR UPDATE TO authenticated
  USING ( EXISTS ( SELECT 1 FROM students WHERE students.id = medical_records.student_id AND students.user_id = (select auth.uid()) ) )
  WITH CHECK ( EXISTS ( SELECT 1 FROM students WHERE students.id = medical_records.student_id AND students.user_id = (select auth.uid()) ) );

DROP POLICY IF EXISTS "Shadchanim can see all data" ON public.medical_records;
CREATE POLICY "Shadchanim can see all data" ON public.medical_records FOR SELECT TO public
  USING ( ((select auth.jwt()) -> 'user_metadata') ->> 'role' = ANY (ARRAY['shadchan', 'admin']) );

-- --- partner_preferences ---
DROP POLICY IF EXISTS "Users can insert partner preferences for their students" ON public.partner_preferences;
CREATE POLICY "Users can insert partner preferences for their students" ON public.partner_preferences FOR INSERT TO authenticated
  WITH CHECK ( EXISTS ( SELECT 1 FROM students WHERE students.id = partner_preferences.student_id AND students.user_id = (select auth.uid()) ) );

DROP POLICY IF EXISTS "Users can read partner preferences for their students" ON public.partner_preferences;
CREATE POLICY "Users can read partner preferences for their students" ON public.partner_preferences FOR SELECT TO authenticated
  USING ( EXISTS ( SELECT 1 FROM students WHERE students.id = partner_preferences.student_id AND students.user_id = (select auth.uid()) ) );

DROP POLICY IF EXISTS "Shadchanim can see all data" ON public.partner_preferences;
CREATE POLICY "Shadchanim can see all data" ON public.partner_preferences FOR SELECT TO public
  USING ( ((select auth.jwt()) -> 'user_metadata') ->> 'role' = ANY (ARRAY['shadchan', 'admin']) );

-- --- references (table name is reserved, use quoted identifier) ---
DROP POLICY IF EXISTS "Users can insert references for their students" ON public.references;
CREATE POLICY "Users can insert references for their students" ON public.references FOR INSERT TO authenticated
  WITH CHECK ( EXISTS ( SELECT 1 FROM students WHERE students.id = public.references.student_id AND students.user_id = (select auth.uid()) ) );

DROP POLICY IF EXISTS "Users can read references for their students" ON public.references;
CREATE POLICY "Users can read references for their students" ON public.references FOR SELECT TO authenticated
  USING ( EXISTS ( SELECT 1 FROM students WHERE students.id = public.references.student_id AND students.user_id = (select auth.uid()) ) );

DROP POLICY IF EXISTS "Shadchanim can see all data" ON public.references;
CREATE POLICY "Shadchanim can see all data" ON public.references FOR SELECT TO public
  USING ( ((select auth.jwt()) -> 'user_metadata') ->> 'role' = ANY (ARRAY['shadchan', 'admin']) );

-- --- previous_partners ---
DROP POLICY IF EXISTS "Users can insert previous partners for their students" ON public.previous_partners;
CREATE POLICY "Users can insert previous partners for their students" ON public.previous_partners FOR INSERT TO authenticated
  WITH CHECK ( EXISTS ( SELECT 1 FROM students WHERE students.id = previous_partners.student_id AND students.user_id = (select auth.uid()) ) );

DROP POLICY IF EXISTS "Users can read previous partners for their students" ON public.previous_partners;
CREATE POLICY "Users can read previous partners for their students" ON public.previous_partners FOR SELECT TO authenticated
  USING ( EXISTS ( SELECT 1 FROM students WHERE students.id = previous_partners.student_id AND students.user_id = (select auth.uid()) ) );

DROP POLICY IF EXISTS "Shadchanim can see all data" ON public.previous_partners;
CREATE POLICY "Shadchanim can see all data" ON public.previous_partners FOR SELECT TO public
  USING ( ((select auth.jwt()) -> 'user_metadata') ->> 'role' = ANY (ARRAY['shadchan', 'admin']) );

-- --- shidduchim ---
DROP POLICY IF EXISTS "Users can view their own shidduchim as shadchan" ON public.shidduchim;
CREATE POLICY "Users can view their own shidduchim as shadchan" ON public.shidduchim FOR SELECT TO public
  USING ( (select auth.uid()) = shadchan_id );

DROP POLICY IF EXISTS "Users can create shidduchim" ON public.shidduchim;
CREATE POLICY "Users can create shidduchim" ON public.shidduchim FOR INSERT TO public
  WITH CHECK ( (select auth.uid()) = shadchan_id );

DROP POLICY IF EXISTS "Users can update their own shidduchim" ON public.shidduchim;
CREATE POLICY "Users can update their own shidduchim" ON public.shidduchim FOR UPDATE TO public
  USING ( (select auth.uid()) = shadchan_id )
  WITH CHECK ( (select auth.uid()) = shadchan_id );

DROP POLICY IF EXISTS "Users can delete their own shidduchim" ON public.shidduchim;
CREATE POLICY "Users can delete their own shidduchim" ON public.shidduchim FOR DELETE TO public
  USING ( (select auth.uid()) = shadchan_id );

-- --- chat_rooms ---
DROP POLICY IF EXISTS "rooms_select_participants" ON public.chat_rooms;
CREATE POLICY "rooms_select_participants" ON public.chat_rooms FOR SELECT TO authenticated
  USING ( (select auth.uid()) = user_a OR (select auth.uid()) = user_b );

DROP POLICY IF EXISTS "rooms_insert_creator_canonical" ON public.chat_rooms;
CREATE POLICY "rooms_insert_creator_canonical" ON public.chat_rooms FOR INSERT TO authenticated
  WITH CHECK ( created_by = (select auth.uid()) AND user_a < user_b AND user_a <> user_b AND ( (select auth.uid()) = user_a OR (select auth.uid()) = user_b ) );

-- --- chat_room_participants ---
DROP POLICY IF EXISTS "participants_select_in_my_rooms" ON public.chat_room_participants;
CREATE POLICY "participants_select_in_my_rooms" ON public.chat_room_participants FOR SELECT TO authenticated
  USING ( EXISTS ( SELECT 1 FROM chat_rooms r WHERE r.room_id = chat_room_participants.room_id AND ( (select auth.uid()) = r.user_a OR (select auth.uid()) = r.user_b ) ) );

DROP POLICY IF EXISTS "participants_insert_room_creator" ON public.chat_room_participants;
CREATE POLICY "participants_insert_room_creator" ON public.chat_room_participants FOR INSERT TO authenticated
  WITH CHECK ( EXISTS ( SELECT 1 FROM chat_rooms r WHERE r.room_id = chat_room_participants.room_id AND r.created_by = (select auth.uid()) ) );

DROP POLICY IF EXISTS "participants_update_self_only" ON public.chat_room_participants;
CREATE POLICY "participants_update_self_only" ON public.chat_room_participants FOR UPDATE TO authenticated
  USING ( (select auth.uid()) = user_id )
  WITH CHECK ( (select auth.uid()) = user_id );

-- --- chat_messages ---
DROP POLICY IF EXISTS "messages_select_participants" ON public.chat_messages;
CREATE POLICY "messages_select_participants" ON public.chat_messages FOR SELECT TO authenticated
  USING ( EXISTS ( SELECT 1 FROM chat_room_participants p WHERE p.room_id = chat_messages.room_id AND p.user_id = (select auth.uid()) AND (p.deleted_before IS NULL OR chat_messages.created_at > p.deleted_before) AND p.hidden_at IS NULL ) );

DROP POLICY IF EXISTS "messages_insert_sender_is_participant" ON public.chat_messages;
CREATE POLICY "messages_insert_sender_is_participant" ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK ( (select auth.uid()) = sender_id AND EXISTS ( SELECT 1 FROM chat_room_participants p WHERE p.room_id = chat_messages.room_id AND p.user_id = (select auth.uid()) ) );

DROP POLICY IF EXISTS "chat_messages_update_own_within_7m" ON public.chat_messages;
CREATE POLICY "chat_messages_update_own_within_7m" ON public.chat_messages FOR UPDATE TO authenticated
  USING ( sender_id = (select auth.uid()) AND created_at > (now() - interval '7 minutes') )
  WITH CHECK ( sender_id = (select auth.uid()) AND created_at > (now() - interval '7 minutes') );

-- --- user_profiles ---
DROP POLICY IF EXISTS "Users can read profiles of users they chat with" ON public.user_profiles;
CREATE POLICY "Users can read profiles of users they chat with" ON public.user_profiles FOR SELECT TO authenticated
  USING ( (select auth.uid()) = id OR EXISTS ( SELECT 1 FROM ( chat_room_participants crp1 JOIN chat_room_participants crp2 ON crp1.room_id = crp2.room_id ) WHERE crp1.user_id = (select auth.uid()) AND crp2.user_id = user_profiles.id AND crp1.deleted_before IS NULL AND crp2.deleted_before IS NULL ) );

-- --- shadchanim_info ---
DROP POLICY IF EXISTS "Shadchanim can view their own info" ON public.shadchanim_info;
CREATE POLICY "Shadchanim can view their own info" ON public.shadchanim_info FOR SELECT TO public
  USING ( (select auth.uid()) = user_id );

DROP POLICY IF EXISTS "Shadchanim can update their own info" ON public.shadchanim_info;
CREATE POLICY "Shadchanim can update their own info" ON public.shadchanim_info FOR UPDATE TO public
  USING ( (select auth.uid()) = user_id )
  WITH CHECK ( (select auth.uid()) = user_id );

DROP POLICY IF EXISTS "Shadchanim can insert their own info" ON public.shadchanim_info;
CREATE POLICY "Shadchanim can insert their own info" ON public.shadchanim_info FOR INSERT TO public
  WITH CHECK ( (select auth.uid()) = user_id );

DROP POLICY IF EXISTS "Admins can manage all shadchanim info" ON public.shadchanim_info;
CREATE POLICY "Admins can manage all shadchanim info" ON public.shadchanim_info FOR ALL TO public
  USING ( ((select auth.jwt()) -> 'user_metadata') ->> 'role' = 'admin' )
  WITH CHECK ( ((select auth.jwt()) -> 'user_metadata') ->> 'role' = 'admin' );

DROP POLICY IF EXISTS "Admins can view all shadchanim info" ON public.shadchanim_info;
CREATE POLICY "Admins can view all shadchanim info" ON public.shadchanim_info FOR SELECT TO public
  USING ( ((select auth.jwt()) -> 'user_metadata') ->> 'role' = 'admin' );

-- --- system_content: is_admin() is security definer; wrap in select for initplan ---
DROP POLICY IF EXISTS "Only admins can manage system content" ON public.system_content;
CREATE POLICY "Only admins can manage system content" ON public.system_content FOR ALL TO public
  USING ( (select is_admin()) )
  WITH CHECK ( (select is_admin()) );
;
