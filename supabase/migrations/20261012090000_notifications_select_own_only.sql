-- התראות: קריאה ומחיקה רק לבעל ההתראה.
--
-- המדיניות הקודמת התירה למנהל לקרוא (ולמחוק) התראות של כל המשתמשים. שום מסך ניהול
-- לא משתמש בכך, והפעמון נשען על ה-RLS בלי לסנן לפי user_id - כך שמנהל ראה בפעמון שלו
-- התראות של אחרים: "התקבלה הצעה" על הצעות ששלח בעצמו, והודעות צ'אט בין משתמש לשדכן אחר.
-- הפעמון מסנן עכשיו במפורש, והמדיניות מצומצמת כדי שהדבר לא יחזור ממקום אחר.
-- כתיבה נשארת דרך טריגרים (SECURITY DEFINER) ו-service_role בלבד.

DROP POLICY IF EXISTS "Notifications select own or admin" ON public.notifications;
DROP POLICY IF EXISTS "Notifications select own" ON public.notifications;
CREATE POLICY "Notifications select own" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Notifications delete own or admin" ON public.notifications;
DROP POLICY IF EXISTS "Notifications delete own" ON public.notifications;
CREATE POLICY "Notifications delete own" ON public.notifications
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));
