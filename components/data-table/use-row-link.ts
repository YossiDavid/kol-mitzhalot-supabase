"use client";

import type { HTMLAttributes, KeyboardEvent, MouseEvent } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";

/**
 * פקדים בתוך השורה שיש להם פעולה משלהם (מועדפים, מחיקה, קישורים).
 * לחיצה עליהם מבצעת רק את הפעולה שלהם ולא פותחת את הכרטיס.
 * `data-row-action` מאפשר לסמן במפורש פקד נוסף שאינו כפתור או קישור.
 */
const INTERACTIVE_SELECTOR = [
  "a",
  "button",
  "input",
  "select",
  "textarea",
  "label",
  '[role="button"]',
  '[role="checkbox"]',
  '[role="switch"]',
  '[role="menuitem"]',
  '[contenteditable="true"]',
  "[data-row-action]",
].join(",");

const MIDDLE_MOUSE_BUTTON = 1;

type RowLinkProps = Pick<
  HTMLAttributes<HTMLElement>,
  | "role"
  | "tabIndex"
  | "onClick"
  | "onAuxClick"
  | "onKeyDown"
  | "aria-label"
  | "aria-keyshortcuts"
>;

/**
 * האם הלחיצה צריכה להישאר אצל פקד פנימי. React מבעבע אירועים גם מתוך
 * portal (למשל דיאלוג המחיקה), שאינו בתוך השורה ב-DOM — גם אותם מסננים.
 */
function belongsToInnerControl(event: MouseEvent<HTMLElement>): boolean {
  const row = event.currentTarget;
  const target = event.target;
  if (!(target instanceof Element) || !row.contains(target)) return true;
  const control = target.closest(INTERACTIVE_SELECTOR);
  return control !== null && row.contains(control);
}

/** גרירה לסימון טקסט אינה כוונה לפתוח את הכרטיס. */
function hasTextSelection(): boolean {
  const selection = window.getSelection();
  return (
    !!selection && !selection.isCollapsed && selection.toString().trim() !== ""
  );
}

function wantsNewTab(event: MouseEvent | KeyboardEvent): boolean {
  return event.metaKey || event.ctrlKey || event.shiftKey;
}

function openInNewTab(href: string) {
  window.open(href, "_blank", "noopener");
}

/**
 * הופך שורה שלמה לקישור: לחיצה בכל מקום בה מנווטת ל-href, בלי לפגוע
 * בפקדים שבתוכה. Cmd/Ctrl/Shift או לחיצה אמצעית פותחים בלשונית חדשה,
 * ו-Enter פותח כשהשורה בפוקוס. הקישור המפורש בשורה נשאר לקוראי מסך.
 */
export function useRowLink() {
  const router = useRouter();

  return function getRowLinkProps<T extends string>(
    href: Route<T>,
    label: string,
  ): RowLinkProps {
    return {
      role: "group",
      tabIndex: 0,
      "aria-label": label,
      "aria-keyshortcuts": "Enter",
      onClick: (event) => {
        if (event.defaultPrevented || belongsToInnerControl(event)) return;
        if (hasTextSelection()) return;
        if (wantsNewTab(event)) {
          openInNewTab(href);
          return;
        }
        router.push(href);
      },
      onAuxClick: (event) => {
        if (event.button !== MIDDLE_MOUSE_BUTTON) return;
        if (event.defaultPrevented || belongsToInnerControl(event)) return;
        event.preventDefault();
        openInNewTab(href);
      },
      onKeyDown: (event) => {
        // Enter בתוך פקד פנימי שייך לפקד עצמו
        if (event.key !== "Enter" || event.target !== event.currentTarget) {
          return;
        }
        event.preventDefault();
        if (wantsNewTab(event)) {
          openInNewTab(href);
          return;
        }
        router.push(href);
      },
    };
  };
}
