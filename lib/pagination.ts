import { z } from "zod";

/**
 * עימוד משותף לרשימות: חישובי עמודים, קריאת פרמטר ה-`page` מה-URL, ושליפת
 * עמוד שמתכווץ לעמוד האחרון הקיים כשמבקשים עמוד שאחרי הסוף. בלי תלות בשרת
 * או בדפדפן, כדי שיתאים גם לשרת וגם ללקוח.
 */

/** שם פרמטר העמוד ב-URL (`?page=2`) */
export const PAGE_SEARCH_PARAM = "page";

/** תקרה שמגינה על offset ענק מ-`?page=99999999999`; הרשימה תתכווץ לעמוד האחרון */
const MAX_PAGE_NUMBER = 100_000;

const pageParamSchema = z.coerce
  .number()
  .int()
  .positive()
  .max(MAX_PAGE_NUMBER)
  .catch(1);

/** מספר עמוד מתוך פרמטר URL: שלם חיובי, וכל ערך לא תקין הופך ל-1 */
export function parsePageParam(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined || value.trim() === "") return 1;
  return pageParamSchema.parse(value);
}

/** טווח השורות (כולל משני הקצוות) של עמוד שמתחיל ב-1 */
export function pageRange(
  page: number,
  pageSize: number,
): { from: number; to: number } {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

/** מספר העמודים הכולל; לפחות 1, גם כשאין תוצאות */
export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/** "מציג 1–20 מתוך 45" - ריק כשאין תוצאות */
export function describeVisibleRange(
  page: number,
  total: number,
  pageSize: number,
): string {
  if (total === 0) return "";
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  return `מציג ${first}–${last} מתוך ${total}`;
}

/** מספרי עמודים עם שלוש נקודות, לרכיב העימוד */
export function getVisiblePaginationPages(
  current: number,
  total: number,
  siblingCount = 1,
): (number | "ellipsis")[] {
  if (total <= 1) return [1];
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | "ellipsis")[] = [1];
  const start = Math.max(2, current - siblingCount);
  const end = Math.min(total - 1, current + siblingCount);

  if (start > 2) pages.push("ellipsis");
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < total - 1) pages.push("ellipsis");
  pages.push(total);
  return pages;
}

/** PostgREST מחזיר 416 (PGRST103) כשה-offset גדול מכמות השורות */
const RANGE_NOT_SATISFIABLE_CODE = "PGRST103";

export function isRangeNotSatisfiable(
  error: { code?: string } | null | undefined,
): boolean {
  return error?.code === RANGE_NOT_SATISFIABLE_CODE;
}

export type PageFetchResult<T> = {
  rows: T[];
  /** הסך הכל בכל העמודים */
  total: number;
  failed: boolean;
  /** הטווח המבוקש מתחיל אחרי הסוף (תשובת 416); הסך הכל אינו ידוע */
  isOutOfRange?: boolean;
};

export type PagedResult<T> = Omit<PageFetchResult<T>, "isOutOfRange"> & {
  /** העמוד שבפועל הוחזר - קטן מהמבוקש כשהמבוקש היה אחרי הסוף */
  page: number;
};

/**
 * שולף עמוד. עמוד שאחרי הסוף (קישור ישן, או שורות שנמחקו) אינו מציג רשימה
 * ריקה אלא את העמוד האחרון הקיים - אותה התנהגות כמו ברשימת המיועדים.
 * כשהשרת דוחה את הטווח (416) אין סך הכל, ולכן שולפים קודם את העמוד הראשון.
 */
export async function fetchPageClamped<T>(
  requestedPage: number,
  pageSize: number,
  fetchPage: (range: {
    from: number;
    to: number;
  }) => Promise<PageFetchResult<T>>,
): Promise<PagedResult<T>> {
  const first = await fetchPage(pageRange(requestedPage, pageSize));
  if (first.failed) return { ...first, page: requestedPage };

  const isBeyondEnd =
    requestedPage > 1 &&
    (first.isOutOfRange || (first.rows.length === 0 && first.total > 0));
  if (!isBeyondEnd) return { ...first, page: requestedPage };

  const probe = first.isOutOfRange
    ? await fetchPage(pageRange(1, pageSize))
    : first;
  if (probe.failed) return { ...probe, page: 1 };

  const lastPage = pageCount(probe.total, pageSize);
  if (lastPage === 1 && first.isOutOfRange) return { ...probe, page: 1 };
  const last = await fetchPage(pageRange(lastPage, pageSize));
  return { ...last, page: lastPage };
}
