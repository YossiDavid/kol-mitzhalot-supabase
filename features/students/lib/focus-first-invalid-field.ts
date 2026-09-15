import { FIELD_NAME_ATTRIBUTE } from "@/features/students/components/create-form/field-layout";

// שדה קובץ מוסתר (גלריה, קו״ח) לא מקבל פוקוס: המשתמש לא רואה אותו, ו-Enter
// היה פותח את חלון בחירת הקבצים. הפוקוס עובר לכפתור ההוספה שלידו.
const TEXT_ENTRY_SELECTOR =
  'input:not([type="hidden"]):not([type="file"]):not([disabled]), textarea:not([disabled])';
const FOCUSABLE_SELECTOR = [
  TEXT_ENTRY_SELECTOR,
  "select:not([disabled])",
  "button:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/**
 * אחרי ולידציה שנכשלה: גולל אל השדה השגוי הראשון לפי סדר התצוגה ומעביר אליו
 * פוקוס. בלי זה, בשלב ארוך נראה כאילו "הבא" לא עושה כלום - השגיאה מעל המסך.
 *
 * ממתין שתי מסגרות, כדי ש-aria-invalid כבר ירונדר על הפקדים. מחזיר Promise
 * שמתממש ב-true אם נמצא שדה.
 */
export function focusFirstInvalidField(
  root: HTMLElement | null,
  isInvalid: (fieldName: string) => boolean,
): Promise<boolean> {
  return new Promise((resolve) => {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => resolve(focusNow(root, isInvalid))),
    );
  });
}

function focusNow(
  root: HTMLElement | null,
  isInvalid: (fieldName: string) => boolean,
): boolean {
  if (!root) return false;

  const cell = findFirstInvalidCell(root, isInvalid);
  if (!cell) return false;

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  // scroll-margin של התא מפצה על הכותרת הדביקה
  cell.scrollIntoView({
    block: "start",
    behavior: prefersReducedMotion ? "auto" : "smooth",
  });
  findFocusTarget(cell)?.focus({ preventScroll: true });
  return true;
}

/**
 * התא השגוי הראשון לפי סדר התצוגה. רשומה חוזרת נחשבת שגויה כשאחד השדות
 * בשורות שלה שגוי - ואז התא של השדה עצמו עדיף על התא של כל הרשומה.
 */
function findFirstInvalidCell(
  root: HTMLElement,
  isInvalid: (fieldName: string) => boolean,
): HTMLElement | undefined {
  const cells = Array.from(
    root.querySelectorAll<HTMLElement>(`[${FIELD_NAME_ATTRIBUTE}]`),
  );
  const isCellInvalid = (candidate: HTMLElement) =>
    isInvalid(candidate.getAttribute(FIELD_NAME_ATTRIBUTE) ?? "");

  let cell = cells.find(isCellInvalid);
  while (cell) {
    const container: HTMLElement = cell;
    const nested = cells.find(
      (candidate) =>
        candidate !== container &&
        container.contains(candidate) &&
        isCellInvalid(candidate),
    );
    if (!nested) break;
    cell = nested;
  }
  return cell;
}

/**
 * הפקד הנכון בתוך התא: קודם הפקד שסומן כשגוי (או פקד בתוכו), ואם אין -
 * שדה ההקלדה הראשון (בשם עם תוארים זה השם ולא רשימת התואר), ואחריו כל פקד
 * שאפשר למקד (רשימה נפתחת, כפתור חיפוש, רדיו, צ'יפ, כפתור הוספה).
 */
function findFocusTarget(cell: HTMLElement): HTMLElement | null {
  const invalid = cell.querySelector<HTMLElement>('[aria-invalid="true"]');
  if (invalid?.matches(FOCUSABLE_SELECTOR)) return invalid;

  return (
    invalid?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ??
    cell.querySelector<HTMLElement>(TEXT_ENTRY_SELECTOR) ??
    cell.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
  );
}
