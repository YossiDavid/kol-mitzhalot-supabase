-- גובה שנשמר במטרים במקום בסנטימטרים.
--
-- שדה הגובה היה טקסט חופשי בלי ולידציה, וחלק מהמשתמשים הזינו 1.8
-- במקום 180. הטופס אוכף מעכשיו מינימום 50, וכאן מתקנים את מה שכבר
-- נשמר.
--
-- הכלל מכוון להיות שמרני:
--   0 < height < 3   → מטרים כמעט בוודאות (1.5-2.1 הוא טווח אנושי).
--                      מוכפל ב-100 ומעוגל: 1.8 → 180, 1.75 → 175.
--   3 <= height < 50 → לא מטרים ולא סנטימטרים. לא נוגעים, כי כל
--                      ניחוש כאן עלול להמציא נתון. מדווח ב-NOTICE
--                      לבדיקה ידנית.
--   height >= 50     → תקין, לא נוגעים.
--
-- אידמפוטנטית: אחרי ההמרה אין יותר ערכים מתחת ל-3, ולכן הרצה שנייה
-- לא תעדכן דבר.

DO $do$
DECLARE
  v_meters    integer;
  v_ambiguous integer;
BEGIN
  SELECT count(*) INTO v_meters
  FROM public.students
  WHERE height IS NOT NULL AND height > 0 AND height < 3;

  SELECT count(*) INTO v_ambiguous
  FROM public.students
  WHERE height IS NOT NULL AND height >= 3 AND height < 50;

  UPDATE public.students
  SET height = ROUND(height * 100)
  WHERE height IS NOT NULL AND height > 0 AND height < 3;

  RAISE NOTICE 'גובה: הומרו % רשומות ממטרים לסנטימטרים', v_meters;

  IF v_ambiguous > 0 THEN
    RAISE NOTICE 'גובה: % רשומות בטווח 3-50 לא הומרו ודורשות בדיקה ידנית', v_ambiguous;
  END IF;
END
$do$;
