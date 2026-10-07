import { ISRAEL_TIME_ZONE } from "@/lib/time-zone";

/** אורך התקציר של פוסט ברשימות (תווים) */
const POST_PREVIEW_CHARS = 280;

/** תקציר של תוכן פוסט: חיתוך ל-POST_PREVIEW_CHARS עם "..." */
export function postPreview(content: string): string {
  return content.length > POST_PREVIEW_CHARS
    ? `${content.slice(0, POST_PREVIEW_CHARS).trimEnd()}...`
    : content;
}

/** שעון ישראל קבוע: השרת רץ ב-UTC ובלי זה השעה המוצגת זזה */
export function formatForumDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: ISRAEL_TIME_ZONE,
  });
}
