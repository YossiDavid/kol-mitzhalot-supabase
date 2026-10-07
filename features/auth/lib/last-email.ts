/**
 * האימייל האחרון שהוקלד בטופס ההתחברות/ההרשמה, נשמר בדפדפן בלבד.
 *
 * נוחות בלבד: מאפשר למלא מראש את האימייל במסך הקוד, בדף השגיאה ובבקשת קישור
 * חדש. הגישה ל-localStorage עלולה להיכשל (חלון פרטי, חסימת אתר), ולכן הכול
 * עטוף ב-try/catch והמסכים עובדים גם בלעדיו.
 */
const STORAGE_KEY = "kol-mitzhalot:last-auth-email";
const MAX_EMAIL_LENGTH = 254;

export function saveLastEmail(email: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, email.slice(0, MAX_EMAIL_LENGTH));
  } catch {
    // אחסון חסום: לא נורא, המשתמש יקליד את האימייל
  }
}

export function readLastEmail(): string {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY) ?? "";
    return stored.includes("@") ? stored.slice(0, MAX_EMAIL_LENGTH) : "";
  } catch {
    return "";
  }
}
