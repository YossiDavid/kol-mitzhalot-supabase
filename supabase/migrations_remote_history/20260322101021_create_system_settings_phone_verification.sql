-- Feature flags / system toggles (single row per key)
CREATE TABLE public.system_settings (
  key text PRIMARY KEY,
  value boolean NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.system_settings IS 'הגדרות מערכת כלליות (דגלים) — ניתן להרחבה לפי מפתח';

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- כל משתמש מחובר יכול לקרוא (נדרש ל-layout / אימות)
CREATE POLICY "system_settings_select_authenticated"
ON public.system_settings FOR SELECT
TO authenticated
USING (true);

INSERT INTO public.system_settings (key, value) VALUES ('phone_verification_enabled', true);
;
