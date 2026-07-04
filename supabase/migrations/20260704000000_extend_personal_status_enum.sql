-- Extend personal_status_enum: add 'widowed', 'engaged', 'married'
-- The original enum had 'widower' (masculine noun); 'widowed' is the gender-neutral adjective
-- used everywhere in the UI. We add 'widowed' and migrate existing rows.
-- 'widower' stays in the enum (orphaned but harmless) to avoid breaking any old data.

ALTER TYPE public.personal_status_enum ADD VALUE IF NOT EXISTS 'widowed';
ALTER TYPE public.personal_status_enum ADD VALUE IF NOT EXISTS 'engaged';
ALTER TYPE public.personal_status_enum ADD VALUE IF NOT EXISTS 'married';

-- Migrate all existing 'widower' rows to the new canonical 'widowed' value
UPDATE public.students SET personal_status = 'widowed' WHERE personal_status = 'widower';
