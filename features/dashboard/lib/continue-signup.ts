import type { ShadchanJoinPrompt } from "./shadchan-join-prompt";

/**
 * "המשך הרשמה" בדשבורד: אחרי אימות המייל המשתמש נוחת ב-/app, אבל ההרשמה
 * עוד לא הושלמה - שדכן/איש צוות צריכים להגיש טופס הצטרפות, והורה/מחפש
 * לעצמו צריך להוסיף כרטיס. היעד מוצג עד שהבקשה הוגשה / שיש כרטיס.
 */
export type ContinueSignupTarget = "shadchan" | "staff" | "card" | "choose";

/** מטרות ההרשמה שמובילות להוספת כרטיס (זהות לערכים ב-signup-purpose) */
const CARD_PURPOSES: ReadonlySet<string> = new Set(["child", "self"]);

interface ContinueSignupInput {
  signupPurpose: string | null;
  shadchanPrompt: ShadchanJoinPrompt;
  staffPrompt: ShadchanJoinPrompt;
  /** כמה כרטיסים יש למשתמש; null = לא ידוע (שגיאה) - לא מציגים */
  ownCardsCount: number | null;
  /** שדכן/מנהל - כבר בתוך המערכת, אין "המשך הרשמה" לכרטיס */
  isShadchanView: boolean;
  /** איש צוות (או מנהל) - כבר בתוך המערכת */
  isStaff?: boolean;
}

export function continueSignupTarget({
  signupPurpose,
  shadchanPrompt,
  staffPrompt,
  ownCardsCount,
  isShadchanView,
  isStaff = false,
}: ContinueSignupInput): ContinueSignupTarget | null {
  if (shadchanPrompt === "complete") return "shadchan";
  if (staffPrompt === "complete") return "staff";
  if (
    signupPurpose !== null &&
    CARD_PURPOSES.has(signupPurpose) &&
    !isShadchanView &&
    ownCardsCount === 0
  ) {
    return "card";
  }
  // נרשם בלי כרטיס, בלי תפקיד ובלי בקשה פתוחה (מטרה אחרת או לא ידועה):
  // מסך בחירה - כרטיס, בקשת שדכן או בקשת איש צוות
  if (
    ownCardsCount === 0 &&
    !isShadchanView &&
    !isStaff &&
    shadchanPrompt !== "pending" &&
    staffPrompt !== "pending"
  ) {
    return "choose";
  }
  return null;
}
