/**
 * כרטיס שבדיקה מזריעה ישירות ב-service role, במצב "מאושר על ידי ההנהלה".
 *
 * כרטיס חדש נוצר ממתין לאישור מנהל, ועד האישור הוא גלוי לבעליו ולמנהלים בלבד.
 * בדיקה שמזריעה כרטיס כדי לפעול עליו כשדכן (רשימה, הצעות, מועדפים, צ'אט)
 * צריכה כרטיס מאושר, והיא אומרת זאת כאן במפורש - בדיוק כפי שההטמעה אישרה את
 * הכרטיסים שהיו קיימים: רגע האישור הוא רגע היצירה (ולכן "חדש היום/השבוע",
 * שנמדד מרגע האישור, מתנהג לפי created_at שהבדיקה קבעה).
 *
 * בדיקה שבודקת את האישור עצמו מזריעה בלי העטיפה הזו, או יוצרת את הכרטיס
 * בנתיב האמיתי של האפליקציה.
 */
type CardSeed = Record<string, unknown>;
type Approved<T> = T & { admin_approved_at: string };

function approve<T extends CardSeed>(row: T): Approved<T> {
  const createdAt = row.created_at;
  return {
    ...row,
    admin_approved_at:
      typeof createdAt === "string" ? createdAt : new Date().toISOString(),
  };
}

export function approvedCard<T extends CardSeed>(row: T): Approved<T>;
export function approvedCard<T extends CardSeed>(
  rows: readonly T[],
): Approved<T>[];
export function approvedCard<T extends CardSeed>(
  rows: T | readonly T[],
): Approved<T> | Approved<T>[] {
  return Array.isArray(rows) ? rows.map(approve) : approve(rows as T);
}
