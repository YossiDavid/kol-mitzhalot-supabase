ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz;
