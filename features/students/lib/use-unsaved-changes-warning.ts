"use client";

import { useEffect, useRef } from "react";

// אזהרה לפני יציאה מטופס עם שינויים שלא נשמרו: סגירה/רענון של הלשונית
// (beforeunload), קישור פנימי באפליקציה, וכפתור "אחורה" של הדפדפן. ניווט
// פרוגרמטי (router.push אחרי שמירה) אינו עובר כאן, ולכן השמירה עצמה לא
// מקפיצה אזהרה.

const LEAVE_CONFIRM_MESSAGE =
  "יש שינויים שלא נשמרו. לעזוב את הדף בלי לשמור אותם?";
const PRIMARY_MOUSE_BUTTON = 0;

function handleBeforeUnload(event: BeforeUnloadEvent): void {
  event.preventDefault();
  // דפדפנים ישנים דורשים returnValue כדי להציג את חלון האישור
  event.returnValue = "";
}

function isModifiedClick(event: MouseEvent): boolean {
  return (
    event.button !== PRIMARY_MOUSE_BUTTON ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

/** קישור שיחליף את הדף הנוכחי בדף אחר באותו אתר */
function findLeavingLink(target: EventTarget | null): HTMLAnchorElement | null {
  if (!(target instanceof Element)) return null;
  const anchor = target.closest("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return null;
  if (anchor.target && anchor.target !== "_self") return null;
  if (anchor.hasAttribute("download")) return null;

  const url = new URL(anchor.href, window.location.href);
  // קישור חיצוני פורק את הדף, ו-beforeunload כבר מטפל בו
  if (url.origin !== window.location.origin) return null;
  const isSamePage =
    url.pathname === window.location.pathname &&
    url.search === window.location.search;
  return isSamePage ? null : anchor;
}

/**
 * רשומת היסטוריה נוספת לאותה כתובת, שעליה נלחץ "אחורה" הבא.
 *
 * ה-state של Next מועתק כמות שהוא: הוא מחזיק את עץ הניווט של ה-App Router,
 * ורשומה עם state ריק הייתה מבלבלת את הראוטר כשחוזרים אליה.
 */
function pushHistoryGuard(): void {
  window.history.pushState(window.history.state, "", window.location.href);
}

export function useUnsavedChangesWarning(shouldWarn: boolean): void {
  const shouldWarnRef = useRef(shouldWarn);
  // הרשומה הנוספת נדחפת פעם אחת, בשינוי הראשון, ונשארת עד יציאה מהדף
  const hasGuardRef = useRef(false);
  // "אחורה" שאושר: ה-popstate השני (זה של היציאה בפועל) לא ייבדק שוב
  const isLeavingRef = useRef(false);

  useEffect(() => {
    shouldWarnRef.current = shouldWarn;
  }, [shouldWarn]);

  useEffect(() => {
    if (!shouldWarn) return;

    // שלב ה-capture על document רץ לפני המאזין של React (ושל next/link),
    // כך שביטול כאן עוצר את הניווט לפני שהתחיל
    const handleLinkClick = (event: MouseEvent) => {
      if (event.defaultPrevented || isModifiedClick(event)) return;
      if (!findLeavingLink(event.target)) return;
      if (window.confirm(LEAVE_CONFIRM_MESSAGE)) return;
      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleLinkClick, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleLinkClick, true);
    };
  }, [shouldWarn]);

  // הרשומה נדחפת רק כשיש מה לאבד: טופס שלא נגעו בו (יצירת כרטיס, למשל)
  // אינו משנה את היסטוריית הדפדפן בכלל.
  useEffect(() => {
    if (!shouldWarn || hasGuardRef.current) return;
    hasGuardRef.current = true;
    pushHistoryGuard();
  }, [shouldWarn]);

  /*
   * "אחורה" פורק את הרשומה הנוספת ומשאיר את המשתמש באותו דף, ורק אז נשאלת
   * השאלה. אישור ליציאה ממשיך אחורה אל הדף הקודם; סירוב דוחף את הרשומה
   * מחדש, כך שגם ה"אחורה" הבא ייעצר. כשאין שינויים (למשל אחרי שמירה) ה-
   * "אחורה" ממשיך מיד, ולמשתמש זו לחיצה אחת רגילה.
   *
   * המאזין רשום כל עוד הרכיב מורכב — גם כשאין שינויים — כי הרשומה הנוספת
   * שנדחפה קודם עדיין קיימת, וצריך לפרוק אותה בשקט.
   *
   * שלבי האשף אינם רשומות היסטוריה אלא state, ולכן "אחורה" לעולם אינו מחליף
   * שלב, והשמירה (שאינה מנווטת) אינה מושפעת.
   */
  useEffect(() => {
    const handlePopState = () => {
      if (!hasGuardRef.current || isLeavingRef.current) return;

      const isLeaveConfirmed =
        !shouldWarnRef.current || window.confirm(LEAVE_CONFIRM_MESSAGE);
      if (!isLeaveConfirmed) {
        pushHistoryGuard();
        return;
      }

      isLeavingRef.current = true;
      hasGuardRef.current = false;
      window.history.back();
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);
}
