/**
 * סירובים מוכרים של הספק שאפשר לתקן בטופס שלנו. ה-iframe מציג אותם בקוד גולמי באנגלית,
 * ולכן ממפים אותם להודעה בעברית ליד השדה הרלוונטי. סירוב שאינו ברשימה לא נוגעים בו.
 * טהור, ללא React.
 *
 * התיעוד הרשמי אינו מפרט קודי NEED: מוכר רק NEED ZEOUT (נצפה בפועל). עבור טלפון ומייל
 * (נדרשים תמיד לחיוב מחוץ לישראל) ההתאמה סבלנית: הודעה שמתחילה ב-"NEED" ואחריה PHONE או MAIL.
 * אין לנו שדה כתובת, ולכן NEED ADRESSE אינו ממופה. כדי להוסיף קוד, מוסיפים שורה לרשימה.
 */
import type { DonationFormField } from "./donation-form";

export interface ProviderFieldError {
  field: DonationFormField;
  message: string;
}

const needMessage = (what: string) =>
  `חברת הסליקה דורשת ${what} להשלמת התרומה בכרטיס זה. נא להזין ולנסות שוב.`;

/** לפי הסדר; ההתאמה הראשונה מנצחת. התבנית נבדקת מול ה-Message אחרי trim */
export const PROVIDER_ERRORS: ReadonlyArray<{
  pattern: RegExp;
  error: ProviderFieldError;
}> = [
  {
    pattern: /need\s+zeout/i,
    error: { field: "donorId", message: needMessage("מספר תעודת זהות") },
  },
  {
    pattern: /^need\s+(phone|tel)/i,
    error: { field: "phone", message: needMessage("מספר טלפון") },
  },
  {
    pattern: /^need\s+(mail|email)/i,
    error: { field: "email", message: needMessage("כתובת מייל") },
  },
];

/** הסירוב המוכר שה-Message מתאים לו, או null */
export function resolveProviderError(
  message: string | null,
): ProviderFieldError | null {
  const text = message?.trim() ?? "";
  if (!text) return null;
  return (
    PROVIDER_ERRORS.find(({ pattern }) => pattern.test(text))?.error ?? null
  );
}
