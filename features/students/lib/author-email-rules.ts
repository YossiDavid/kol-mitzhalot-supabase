import type { StudentFormValues } from "@/features/students/components/create-form/schema";
import { AUTHOR_EMAIL_OPTIONAL_VALUE } from "@/features/students/components/create-form/fields-data/author-fields";

/**
 * כללי אימייל ממלא הכרטיס בעריכה (נקבעים בשרת לפי הסשן, לא לפי קלט לקוח):
 *  - הבעלים: אימייל חובה; כרטיס ישן בלי אימייל מתמלא מראש באימייל החשבון
 *    שלו (ניתן לעריכה), כמו ביצירה.
 *  - עורך שאינו הבעלים (אדמין / שדכן): לא ממלאים בשבילו, והשדה אינו חובה -
 *    הוא אינו יכול לדעת את האימייל של הממלא.
 * אין בדיקה מקבילה בשרת: חוקי השדות שייכים לטופס (save-profile-server.ts).
 */
export function applyAuthorEmailRules(
  values: StudentFormValues,
  options: { isOwner: boolean; accountEmail: string | null | undefined },
): StudentFormValues {
  if (!options.isOwner) {
    return { ...values, authorEmailOptional: AUTHOR_EMAIL_OPTIONAL_VALUE };
  }
  const hasStoredEmail = values.author.email.trim() !== "";
  if (hasStoredEmail || !options.accountEmail) return values;
  return {
    ...values,
    author: { ...values.author, email: options.accountEmail },
  };
}
