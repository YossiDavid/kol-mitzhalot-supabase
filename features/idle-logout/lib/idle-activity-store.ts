/**
 * זמן הפעילות האחרונה ואות ההתנתקות, משותפים לכל הלשוניות דרך localStorage.
 * Callers: features/idle-logout/lib/use-idle-logout.ts.
 *
 * כל גישה עטופה ב-try/catch: בחלון פרטי או כשהאחסון חסום localStorage זורק,
 * ואז כל לשונית סופרת לבד (ההתנתקות עדיין עובדת, רק לא מסונכרנת).
 */
import {
  IDLE_ACTIVITY_STORAGE_KEY,
  IDLE_LOGOUT_STORAGE_KEY,
} from "@/features/idle-logout/lib/idle-logout-model";
import { ADMIN_IMPERSONATION_BACKUP_KEY } from "@/lib/impersonation";

/** זמן הפעילות האחרונה שנרשם בלשונית כלשהי, או null כשאין / לא נגיש */
export function readSharedActivity(): number | null {
  try {
    return parseTimestamp(
      window.localStorage.getItem(IDLE_ACTIVITY_STORAGE_KEY),
    );
  } catch {
    return null;
  }
}

export function writeSharedActivity(at: number): void {
  try {
    window.localStorage.setItem(IDLE_ACTIVITY_STORAGE_KEY, String(at));
  } catch {
    // אחסון חסום: הלשונית ממשיכה לספור לבד
  }
}

/**
 * שינוי המפתח מפעיל אירוע storage בשאר הלשוניות, והן עוברות לאותו דף
 * התחברות (עם או בלי הודעת חוסר הפעילות). הזמן בערך מבטיח שהערך משתנה.
 */
export function broadcastLogout(loginPath: string): void {
  try {
    window.localStorage.setItem(
      IDLE_LOGOUT_STORAGE_KEY,
      JSON.stringify({ at: Date.now(), path: loginPath }),
    );
  } catch {
    // אחסון חסום: שאר הלשוניות יתנתקו בעצמן כשהזמן שלהן ייגמר
  }
}

/** דף ההתחברות מתוך אות ההתנתקות; רק נתיב תחת /auth/login מתקבל */
export function readLogoutPath(raw: string | null, fallback: string): string {
  try {
    const path: unknown = raw ? JSON.parse(raw).path : null;
    return typeof path === "string" && path.startsWith("/auth/login")
      ? path
      : fallback;
  } catch {
    return fallback;
  }
}

/**
 * בזמן התחזות, הסשן של המנהל שמור ב-sessionStorage. התנתקות אוטומטית מוחקת
 * אותו, כדי שלא יישאר במחשב שנעזב בלי השגחה.
 */
export function clearImpersonationBackup(): void {
  try {
    window.sessionStorage.removeItem(ADMIN_IMPERSONATION_BACKUP_KEY);
  } catch {
    // אחסון חסום: אין גיבוי למחוק
  }
}

export function parseTimestamp(raw: string | null): number | null {
  if (raw == null) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}
