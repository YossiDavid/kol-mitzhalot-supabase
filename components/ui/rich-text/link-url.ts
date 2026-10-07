/** סכמות מותרות בקישור, תואם לרשימה של sanitizeArticleHtml */
const SAFE_SCHEME = /^(https?|mailto|tel):/i;
const ANY_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * מנרמל כתובת שהוקלדה בחלון הקישור. מחזיר null כשהכתובת אינה בטוחה או
 * אינה תקינה (javascript:, data: וכד'). כתובת בלי סכמה (example.com)
 * מקבלת https://, ונתיב פנימי (/knowledge) נשמר כמו שהוא.
 */
export function normalizeLinkUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value || /\s/.test(value)) return null;

  if (value.startsWith("/") && !value.startsWith("//")) return value;
  if (SAFE_SCHEME.test(value)) return isParsable(value) ? value : null;
  if (ANY_SCHEME.test(value)) return null;

  const withScheme = `https://${value.replace(/^\/\//, "")}`;
  return isParsable(withScheme) && new URL(withScheme).hostname.includes(".")
    ? withScheme
    : null;
}

function isParsable(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
