-- Align local schema with what the students list UI expects.
-- These changes existed in local-only migrations but were never on cloud history.

ALTER TYPE public.personal_status_enum ADD VALUE IF NOT EXISTS 'widowed';
ALTER TYPE public.personal_status_enum ADD VALUE IF NOT EXISTS 'engaged';
ALTER TYPE public.personal_status_enum ADD VALUE IF NOT EXISTS 'married';

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz;
