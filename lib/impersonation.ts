/** sessionStorage key for saving admin session during impersonation (client-only). */
export const ADMIN_IMPERSONATION_BACKUP_KEY = "admin_impersonation_backup";

/**
 * עוגייה (httpOnly) עם מזהה המשתמש שהמנהל מתחזה אליו. ה-proxy לא מעדכן
 * "נראה לאחרונה" כשהמשתמש המחובר הוא אותו משתמש - כניסת מנהל אינה פעילות
 * אמיתית של המשתמש. אחרי החזרה לחשבון המנהל המזהה כבר לא תואם, ולכן אין
 * צורך למחוק אותה.
 */
export const IMPERSONATION_TARGET_COOKIE = "km_impersonating";
export const IMPERSONATION_TARGET_MAX_AGE_SECONDS = 12 * 60 * 60;
