/**
 * התנתקות אוטומטית אחרי חוסר פעילות: הגדרת המנהל (דקות, 0 = כבוי) וקבועי
 * המנגנון. הקובץ טהור, ומשותף לשרת (קריאה וכתיבה), לטופס ולשומר בדפדפן.
 *
 * הערך נשמר ב-system_settings.text_value כמחרוזת של מספר שלם: לטבלה אין עמודה
 * מספרית, ו-text_value כבר קיימת להגדרות שאינן דגל. אין שורה = ברירת המחדל.
 */
import { z } from "zod";

/** מפתח השורה ב-system_settings */
export const IDLE_LOGOUT_SETTING_KEY = "idle_logout_minutes";

/** כשאין שורה (או שהיא לא תקינה): חצי שעה */
export const IDLE_LOGOUT_DEFAULT_MINUTES = 30;

/** תקרה סבירה: יממה. מעבר לזה עדיף לכבות */
export const IDLE_LOGOUT_MAX_MINUTES = 24 * 60;

/** בחירות מהירות בטופס המנהל (0 = כבוי) */
export const IDLE_LOGOUT_PRESETS = [15, 30, 60, 120] as const;

/** כמה זמן לפני ההתנתקות מוצג "עדיין כאן?" (לכל היותר חצי מהזמן כולו) */
export const IDLE_WARNING_MS = 60_000;

/** מפתח זמן הפעילות האחרונה ב-localStorage, משותף לכל הלשוניות */
export const IDLE_ACTIVITY_STORAGE_KEY = "idle_last_activity";

/** מפתח "התנתקנו" ב-localStorage: שינוי שלו מנתק את שאר הלשוניות */
export const IDLE_LOGOUT_STORAGE_KEY = "idle_logout_at";

/** פרמטר הסיבה בכתובת ההתחברות אחרי התנתקות אוטומטית */
export const IDLE_LOGOUT_REASON = "idle";
export const IDLE_LOGOUT_LOGIN_PATH = `/auth/login?reason=${IDLE_LOGOUT_REASON}`;

export const IDLE_LOGOUT_LOGIN_MESSAGE = "נותקת אוטומטית לאחר חוסר פעילות";

export const idleLogoutMinutesSchema = z.coerce
  .number({ message: "יש להזין מספר דקות" })
  .int("יש להזין מספר שלם של דקות")
  .min(0, "המספר לא יכול להיות שלילי")
  .max(IDLE_LOGOUT_MAX_MINUTES, `עד ${IDLE_LOGOUT_MAX_MINUTES} דקות`);

/** ערך שמור (טקסט מהטבלה) לדקות; לא תקין או חסר = ברירת המחדל */
export function parseIdleLogoutMinutes(raw: string | null | undefined): number {
  if (raw == null || raw.trim() === "") return IDLE_LOGOUT_DEFAULT_MINUTES;
  const parsed = idleLogoutMinutesSchema.safeParse(raw);
  return parsed.success ? parsed.data : IDLE_LOGOUT_DEFAULT_MINUTES;
}

/** תיאור קצר לבחירות המהירות ולהודעות */
export function formatIdleMinutes(minutes: number): string {
  if (minutes === 0) return "כבוי";
  if (minutes === 60) return "שעה";
  if (minutes === 120) return "שעתיים";
  return `${minutes} דקות`;
}

export const IDLE_LOGOUT_MESSAGES = {
  forbidden: "אין הרשאה לבצע את הפעולה",
  saveFailed: "השמירה נכשלה. נסו שוב",
  saved: "זמן ההתנתקות נשמר",
  disabled: "ההתנתקות האוטומטית כובתה",
} as const;
