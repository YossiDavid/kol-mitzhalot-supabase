-- איש צוות שהמוסד שלו לא ברשימה צריך יכולת להוסיף אותו בעצמו.
--
-- המדיניות על institutions מתירה כתיבה למנהל בלבד
-- ("Institutions admin manage all"), ולכן נדרשת פונקציית SECURITY
-- DEFINER מצומצמת במקום פתיחת INSERT לכל המשתמשים.
--
-- המוסד נוצר פעיל: הרשימה משותפת, ואיש צוות שמוסיף את הישיבה שבה
-- הוא מלמד מוסיף מידע אמיתי. ההגנה מפני זיהום הרשימה היא איתור
-- כפילויות — שם ועיר זהים (ללא תלות באותיות ורווחים) מחזירים את
-- המוסד הקיים במקום ליצור חדש.
--
-- אידמפוטנטית — ניתן להריץ שוב.

CREATE OR REPLACE FUNCTION public.request_institution(
  p_name   text,
  p_gender text,
  p_type   text,
  p_city   text DEFAULT NULL
) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  v_name     text;
  v_city     text;
  v_existing uuid;
  v_id       uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required'
      USING HINT = 'הוספת מוסד דורשת התחברות';
  END IF;

  v_name := NULLIF(BTRIM(p_name), '');
  v_city := NULLIF(BTRIM(COALESCE(p_city, '')), '');

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'institution_name_required'
      USING HINT = 'נדרש שם מוסד';
  END IF;

  IF p_gender NOT IN ('male', 'female') THEN
    RAISE EXCEPTION 'institution_gender_invalid'
      USING HINT = 'יש לבחור בנים או בנות';
  END IF;

  IF p_type NOT IN (
    'yeshiva_gedola', 'yeshiva_ketana', 'seminary',
    'school', 'talmud_torah', 'kollel', 'other'
  ) THEN
    RAISE EXCEPTION 'institution_type_invalid'
      USING HINT = 'סוג מוסד לא מוכר';
  END IF;

  -- כפילות: אותו שם ואותה עיר. משווים אחרי BTRIM ובלי תלות באותיות,
  -- כדי ש"ישיבת אור החיים " לא ייווצר לצד "ישיבת אור החיים".
  SELECT id INTO v_existing
  FROM public.institutions
  WHERE LOWER(BTRIM(name)) = LOWER(v_name)
    AND LOWER(BTRIM(COALESCE(city, ''))) = LOWER(COALESCE(v_city, ''))
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  INSERT INTO public.institutions (name, city, gender, type, is_active)
  VALUES (v_name, v_city, p_gender, p_type, true)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

ALTER FUNCTION public.request_institution(text, text, text, text) OWNER TO postgres;

COMMENT ON FUNCTION public.request_institution(text, text, text, text)
  IS 'הוספת מוסד לימודים על ידי משתמש מחובר. מחזיר מוסד קיים אם שם ועיר זהים, כדי למנוע כפילויות.';

REVOKE ALL ON FUNCTION public.request_institution(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.request_institution(text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.request_institution(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_institution(text, text, text, text) TO service_role;
