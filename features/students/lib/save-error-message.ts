/**
 * תשובה שאינה JSON מ-Supabase (למשל דף HTML) אינה מגיעה מהמסד: משהו בדרך החליף אותה,
 * בדרך כלל סינון אינטרנט או רשת ארגונית שחוסמים את הבקשה. במקרה כזה הודעת ה-SyntaxError
 * הגולמית חסרת משמעות למשתמש, ולכן מוצגת הנחיה במקומה.
 */
const NON_JSON_RESPONSE_PATTERN =
  /not valid JSON|Unexpected token|JSON\.parse|Unexpected end of JSON/i;

/** כשל רשת מוחלט: הבקשה לא יצאה או לא חזרה */
const NETWORK_FAILURE_PATTERN = /Failed to fetch|NetworkError|Load failed/i;

export const BLOCKED_RESPONSE_MESSAGE =
  "השמירה נחסמה בדרך לשרת. ייתכן שסינון האינטרנט או הרשת חוסמים אותה. אפשר לנסות שוב, לנסות מרשת אחרת, או לפנות אלינו דרך עמוד צרו קשר.";

export const NETWORK_FAILURE_MESSAGE =
  "לא הצלחנו להתחבר לשרת. בדקו את החיבור לאינטרנט ונסו שוב.";

/** מחזיר הודעה למשתמש על כשל בשמירת כרטיס, במקום טקסט השגיאה הגולמי כשהוא לא מועיל */
export function describeStudentSaveError(rawMessage: string): string {
  if (NON_JSON_RESPONSE_PATTERN.test(rawMessage))
    return BLOCKED_RESPONSE_MESSAGE;
  if (NETWORK_FAILURE_PATTERN.test(rawMessage)) return NETWORK_FAILURE_MESSAGE;
  return rawMessage;
}
