"use client";

import { useEffect } from "react";

// אזהרה לפני יציאה מטופס עם שינויים שלא נשמרו: סגירה/רענון של הלשונית
// (beforeunload) וקישור פנימי באפליקציה. ניווט פרוגרמטי (router.push אחרי
// שמירה) אינו עובר כאן, ולכן השמירה עצמה לא מקפיצה אזהרה.

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

export function useUnsavedChangesWarning(shouldWarn: boolean): void {
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
}
