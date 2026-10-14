import type { StudentFormValues } from "@/features/students/components/create-form/schema";
import { AUTHOR_EMAIL_OPTIONAL_VALUE } from "@/features/students/components/create-form/fields-data/author-fields";

/**
 * כללי פרטי ממלא הכרטיס (אימייל ושם) בעריכה (נקבעים בשרת לפי הסשן, לא לפי קלט
 * לקוח):
 *  - הבעלים: אימייל ושם חובה; כרטיס ישן שחסר בו אחד מהם מתמלא מראש באימייל
 *    ובשם של החשבון שלו (ניתנים לעריכה), כמו ביצירה.
 *  - עורך שאינו הבעלים (אדמין / שדכן): לא ממלאים בשבילו, והשדות אינם חובה -
 *    הוא אינו יכול לדעת את הפרטים של הממלא.
 * אין בדיקה מקבילה בשרת: חוקי השדות שייכים לטופס (save-profile-server.ts).
 */
export function applyAuthorRules(
  values: StudentFormValues,
  options: {
    isOwner: boolean;
    accountEmail: string | null | undefined;
    accountName: string | null | undefined;
  },
): StudentFormValues {
  if (!options.isOwner) {
    return { ...values, authorEmailOptional: AUTHOR_EMAIL_OPTIONAL_VALUE };
  }
  const email =
    values.author.email.trim() === "" && options.accountEmail
      ? options.accountEmail
      : values.author.email;
  const name =
    values.author.name.trim() === "" && options.accountName
      ? options.accountName
      : values.author.name;
  if (email === values.author.email && name === values.author.name) {
    return values;
  }
  return { ...values, author: { ...values.author, email, name } };
}
