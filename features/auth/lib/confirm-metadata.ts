import type { Metadata } from "next";

/**
 * מסך האישור נטען עם אסימון בכתובת: בלי referrer כדי שהכתובת לא תדלוף
 * למשאבים חיצוניים, ובלי אינדוקס.
 */
export const confirmPageMetadata: Metadata = {
  title: "כניסה למערכת",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};
