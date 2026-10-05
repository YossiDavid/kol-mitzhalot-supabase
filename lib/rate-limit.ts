/**
 * הגבלת קצב בזיכרון (חלון קבוע), באותה גישה כמו שליחת ה-OTP. הספירה היא לכל
 * instance של השרת: ב-Vercel כל instance סופר לבד, ולכן זו הגנה נגד שימוש לרעה
 * רגיל ולא מכסה קשיחה.
 */
const PRUNE_THRESHOLD = 5_000;

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimiter {
  /** true כשהבקשה מותרת (וסופרת); false כשחרגו מהמכסה */
  allow: (key: string, now?: number) => boolean;
}

export function createRateLimiter(options: {
  limit: number;
  windowMs: number;
}): RateLimiter {
  const buckets = new Map<string, Bucket>();

  function prune(now: number) {
    for (const [key, bucket] of buckets) {
      if (now > bucket.resetAt) buckets.delete(key);
    }
  }

  return {
    allow(key, now = Date.now()) {
      if (buckets.size > PRUNE_THRESHOLD) prune(now);
      const current = buckets.get(key);
      if (!current || now > current.resetAt) {
        buckets.set(key, { count: 1, resetAt: now + options.windowMs });
        return true;
      }
      if (current.count >= options.limit) return false;
      buckets.set(key, { ...current, count: current.count + 1 });
      return true;
    },
  };
}
