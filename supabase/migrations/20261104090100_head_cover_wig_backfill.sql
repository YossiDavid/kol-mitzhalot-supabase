-- המרת "מטפחת על הפאה" (kerchief_on_wig) ל"פאה וכובע" (wig_and_hat).
-- הטריגרים של students ו-partner_preferences כבויים בזמן ההמרה: זה שינוי ניסוח של ההנהלה,
-- ואסור שיפיק התראות "הכרטיס עודכן" או רישום פעילות לבעלי הכרטיסים.
ALTER TABLE public.students DISABLE TRIGGER USER;
UPDATE public.students
   SET head_cover_type = 'wig_and_hat'
 WHERE head_cover_type = 'kerchief_on_wig';
ALTER TABLE public.students ENABLE TRIGGER USER;

ALTER TABLE public.partner_preferences DISABLE TRIGGER USER;
UPDATE public.partner_preferences
   SET head_cover_type = 'wig_and_hat'
 WHERE head_cover_type = 'kerchief_on_wig';
ALTER TABLE public.partner_preferences ENABLE TRIGGER USER;
