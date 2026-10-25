/** טלפון (+972..., 050-...): ספרות, רווחים, מקפים ו-+ בהתחלה - אינו נוסחה */
const PHONE_LIKE = /^\+?[\d\- ]+$/;

/** תא CSV: גרשיים כפולים, ומניעת הזרקת נוסחאות באקסל (= + - @ טאב CR) */
export function csvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  const isFormulaLike = /^[=+\-@\t\r]/.test(text) && !PHONE_LIKE.test(text);
  const safe = isFormulaLike ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function toCsv(rows: readonly (readonly (string | number | null)[])[]): string {
  // BOM כדי שאקסל יזהה UTF-8 ויציג עברית
  return "﻿" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
