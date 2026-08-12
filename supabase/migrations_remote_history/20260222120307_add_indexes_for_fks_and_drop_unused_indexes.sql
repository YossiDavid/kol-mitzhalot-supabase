
-- =============================================================================
-- 1. Add covering indexes for foreign keys (improves JOINs and CASCADE checks)
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_chat_rooms_created_by
  ON public.chat_rooms (created_by);

CREATE INDEX IF NOT EXISTS idx_chat_rooms_last_message_id
  ON public.chat_rooms (last_message_id);

CREATE INDEX IF NOT EXISTS idx_chat_rooms_user_b
  ON public.chat_rooms (user_b);

CREATE INDEX IF NOT EXISTS idx_education_history_student_id
  ON public.education_history (student_id);

CREATE INDEX IF NOT EXISTS idx_employment_history_student_id
  ON public.employment_history (student_id);

CREATE INDEX IF NOT EXISTS idx_previous_partners_student_id
  ON public.previous_partners (student_id);

CREATE INDEX IF NOT EXISTS idx_references_student_id
  ON public.references (student_id);

-- =============================================================================
-- 2. Drop unused indexes (reduces write overhead, simplifies schema)
-- =============================================================================

DROP INDEX IF EXISTS public.idx_shidduchim_status;
DROP INDEX IF EXISTS public.idx_shidduchim_created_at;
DROP INDEX IF EXISTS public.students_city_idx;
DROP INDEX IF EXISTS public.students_birth_date_idx;
DROP INDEX IF EXISTS public.chat_rooms_last_message_at_idx;
DROP INDEX IF EXISTS public.chat_messages_sender_created_at_idx;
DROP INDEX IF EXISTS public.chat_messages_reply_to_idx;
DROP INDEX IF EXISTS public.idx_shadchanim_info_location;
;
