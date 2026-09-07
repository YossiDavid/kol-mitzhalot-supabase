-- מניעת מוסדות כפולים.
--
-- app/app/admin/institutions/page.tsx כבר מטפל בשגיאה 23505 עם
-- ההודעה "מוסד עם אותו שם, עיר ומגדר כבר קיים במאגר", אבל לטבלה
-- היה רק PK — כלומר הענף הזה היה קוד מת. ייבוא אקסל חוזר היה יוצר
-- כפילויות בלי שום התנגדות.
--
-- ההשוואה מנורמלת (lower + btrim, ו-city ריק כמחרוזת ריקה), כדי
-- ש"ישיבת אור החיים " לא יחיה לצד "ישיבת אור החיים". זו בדיוק
-- הנורמליזציה שכבר קיימת ב-public.request_institution.
--
-- אידמפוטנטית — ניתן להריץ שוב.

-- ── איחוד כפילויות קיימות ────────────────────────────────────────
-- ארבע טבלאות מקשרות למוסד, ולכן קודם מפנים אותן לשורה השורדת ורק
-- אז מוחקים. מחיקה ישירה הייתה נכשלת על ה-FK או מוחקת שיוכים.
DO $do$
DECLARE
  v_groups integer;
  v_merged integer;
BEGIN
  CREATE TEMP TABLE dup_map ON COMMIT DROP AS
  WITH ranked AS (
    SELECT
      id,
      first_value(id) OVER (
        PARTITION BY lower(btrim(name)), lower(btrim(coalesce(city, ''))), gender
        ORDER BY created_at, id
      ) AS keep_id
    FROM public.institutions
  )
  SELECT id AS dup_id, keep_id FROM ranked WHERE id <> keep_id;

  SELECT count(DISTINCT keep_id), count(*) INTO v_groups, v_merged FROM dup_map;

  IF v_merged = 0 THEN
    RAISE NOTICE 'מוסדות: לא נמצאו כפילויות';
  ELSE
    UPDATE public.students s
    SET institution_id = m.keep_id
    FROM dup_map m WHERE s.institution_id = m.dup_id;

    UPDATE public.staff_info si
    SET institution_id = m.keep_id
    FROM dup_map m WHERE si.institution_id = m.dup_id;

    UPDATE public.student_notes n
    SET author_institution_id = m.keep_id
    FROM dup_map m WHERE n.author_institution_id = m.dup_id;

    -- staff_institutions נושא UNIQUE(user_id, institution_id), ולכן
    -- הפניה מחדש עלולה להתנגש בשורה שכבר קיימת. מוחקים את המתנגשות
    -- לפני העדכון, כדי לא לאבד את השיוך הקיים.
    DELETE FROM public.staff_institutions a
    USING dup_map m, public.staff_institutions b
    WHERE a.institution_id = m.dup_id
      AND b.user_id = a.user_id
      AND b.institution_id = m.keep_id;

    UPDATE public.staff_institutions a
    SET institution_id = m.keep_id
    FROM dup_map m WHERE a.institution_id = m.dup_id;

    DELETE FROM public.institutions i USING dup_map m WHERE i.id = m.dup_id;

    RAISE NOTICE 'מוסדות: אוחדו % רשומות כפולות אל % מוסדות', v_merged, v_groups;
  END IF;
END
$do$;

-- ── האילוץ ────────────────────────────────────────────────────────
-- אינדקס ייחודי על ביטוי ולא CONSTRAINT, כי אילוץ טבלה אינו יכול
-- לכלול פונקציות. הוא עדיין מפיק 23505, שזה מה שהממשק מצפה לו.
CREATE UNIQUE INDEX IF NOT EXISTS institutions_name_city_gender_key
  ON public.institutions (
    lower(btrim(name)),
    lower(btrim(coalesce(city, ''))),
    gender
  );

COMMENT ON INDEX public.institutions_name_city_gender_key
  IS 'מונע מוסדות כפולים. ההשוואה מנורמלת, כמו ב-request_institution.';
