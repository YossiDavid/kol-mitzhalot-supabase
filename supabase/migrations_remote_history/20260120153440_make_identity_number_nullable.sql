-- שינוי identity_number להיות nullable
ALTER TABLE public.students 
ALTER COLUMN identity_number DROP NOT NULL;;
