// כללי קובץ קו״ח שמועלה מהטבלה - משותף לדיאלוג (לפני שליחה) ולשרת (אכיפה).

/** גודל מרבי לקובץ קו״ח */
export const CV_MAX_BYTES = 5 * 1024 * 1024;

export const CV_MAX_SIZE_LABEL = "5MB";

const CV_MIME_TYPES: readonly string[] = [
  "application/pdf",
  "image/png",
  "image/jpeg",
];

/** הודעת שגיאה לקובץ שאינו מתאים, או null כשהקובץ תקין */
export function validateCvFile(
  file: Pick<File, "type" | "size">,
): string | null {
  if (!CV_MIME_TYPES.includes(file.type)) {
    return "ניתן להעלות קובץ PDF או תמונה (PNG, JPG)";
  }
  if (file.size === 0) {
    return "הקובץ ריק";
  }
  if (file.size > CV_MAX_BYTES) {
    return `הקובץ גדול מ-${CV_MAX_SIZE_LABEL}`;
  }
  return null;
}
