/**
 * סטטוסים שמוציאים את הכרטיס משידוכים (in_shidduchim=false). ברשימה
 * הרגילה הם מוסתרים, אבל סינון מפורש לפיהם מציג אותם - אחרת כרטיס שסומן
 * "נשוי" בטעות נעלם ואין דרך להגיע אליו כדי להחזיר את הסטטוס.
 */
const OUT_OF_SHIDDUCHIM_STATUSES: readonly string[] = ["engaged", "married"];

/** מאורס או נשוי - אינם רלוונטיים לשידוך */
export function isOutOfShidduchimStatus(
  status: string | null | undefined,
): boolean {
  return !!status && OUT_OF_SHIDDUCHIM_STATUSES.includes(status);
}

/** מאורס בחודש האחרון (או בלי תאריך שינוי, בשורות ישנות) - מודגש ברשימות */
export function isRecentlyEngaged(student: {
  personal_status: string;
  status_changed_at?: string | null;
}): boolean {
  if (student.personal_status !== "engaged") return false;
  if (!student.status_changed_at) return true;
  const changedAt = new Date(student.status_changed_at);
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  return changedAt >= oneMonthAgo;
}
