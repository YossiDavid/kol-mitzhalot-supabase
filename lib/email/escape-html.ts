const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * בריחה של ערך דינמי לפני שהוא נכנס ל-HTML של מייל. שמות, סיבות דחייה
 * והודעות שדכן הם קלט חופשי של משתמשים, ולכן כל ערך עובר כאן - בלי יוצא מהכלל.
 */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

/** טקסט רב-שורתי ל-HTML: בריחה ושבירות שורה כ-<br /> */
export function escapeHtmlMultiline(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, "<br />");
}
