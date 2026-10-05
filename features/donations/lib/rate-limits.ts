import { createRateLimiter } from "@/lib/rate-limit";

const MINUTE_MS = 60_000;

/** יצירת כוונות תרומה: נדיב לתורם אמיתי, חוסם הצפת שורות */
export const intentLimiter = createRateLimiter({
  limit: 20,
  windowMs: 10 * MINUTE_MS,
});

/** בדיקת סטטוס: הלקוח שואל כמה פעמים ברצף אחרי תשלום */
export const statusLimiter = createRateLimiter({
  limit: 60,
  windowMs: MINUTE_MS,
});

export const RETRY_AFTER_SECONDS = "60";
