"use client";

import type { Editor } from "@tiptap/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

import type { SlashMenuState } from "./use-slash-menu";

export const SLASH_LISTBOX_ID = "slash-command-listbox";
const optionId = (id: string) => `slash-option-${id}`;

/** רווח מהקרט, ומהקצה של המסך */
const MENU_GAP_PX = 6;
const VIEWPORT_MARGIN_PX = 8;
const MENU_MAX_HEIGHT_PX = 320;

interface Position {
  top: number;
  left: number;
  maxHeight: number;
}

/**
 * מיקום התפריט ביחס לקרט, בקואורדינטות viewport. במסמך RTL התפריט נפרש
 * שמאלה מנקודת הקרט (קצה ההתחלה הלוגי מיושר לקרט), ב-LTR ימינה. נשאר
 * בתוך המסך, ונפתח מעל הקרט כשאין מקום מתחתיו.
 */
function computePosition(
  caret: DOMRect,
  menu: { width: number; height: number },
  isRtl: boolean,
): Position {
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;
  const maxHeight = Math.min(
    MENU_MAX_HEIGHT_PX,
    viewportH - 2 * VIEWPORT_MARGIN_PX,
  );
  const height = Math.min(menu.height, maxHeight);

  const rawLeft = isRtl ? caret.right - menu.width : caret.left;
  const left = Math.max(
    VIEWPORT_MARGIN_PX,
    Math.min(rawLeft, viewportW - menu.width - VIEWPORT_MARGIN_PX),
  );

  const below = caret.bottom + MENU_GAP_PX;
  const above = caret.top - MENU_GAP_PX - height;
  const fitsBelow = below + height <= viewportH - VIEWPORT_MARGIN_PX;
  const top = fitsBelow || above < VIEWPORT_MARGIN_PX ? below : above;

  return {
    top: Math.max(
      VIEWPORT_MARGIN_PX,
      Math.min(top, viewportH - height - VIEWPORT_MARGIN_PX),
    ),
    left,
    maxHeight,
  };
}

interface SlashMenuProps {
  editor: Editor;
  menu: SlashMenuState | null;
  onHover: (index: number) => void;
}

/**
 * תפריט פקודות "/" צף. הפוקוס נשאר בעורך (combobox): הקשרים מנוהלים ב-
 * render של ה-suggestion, והתפריט מקושר אליו ב-aria-controls ו-
 * aria-activedescendant.
 */
export function SlashMenu({ editor, menu, onHover }: SlashMenuProps) {
  const menuElRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const isOpen = menu !== null;
  const activeItem = menu?.items[menu.activeIndex];
  const activeId = activeItem ? optionId(activeItem.id) : null;

  // סמנטיקת combobox על אלמנט ה-contenteditable, רק כשהתפריט פתוח
  useEffect(() => {
    const dom = editor.view.dom;
    if (!isOpen) return;
    dom.setAttribute("role", "combobox");
    dom.setAttribute("aria-haspopup", "listbox");
    dom.setAttribute("aria-expanded", "true");
    dom.setAttribute("aria-controls", SLASH_LISTBOX_ID);
    dom.setAttribute("aria-autocomplete", "list");
    return () => {
      for (const name of [
        "role",
        "aria-haspopup",
        "aria-expanded",
        "aria-controls",
        "aria-autocomplete",
        "aria-activedescendant",
      ]) {
        dom.removeAttribute(name);
      }
    };
  }, [editor, isOpen]);

  useEffect(() => {
    const dom = editor.view.dom;
    if (activeId) dom.setAttribute("aria-activedescendant", activeId);
    else dom.removeAttribute("aria-activedescendant");
  }, [editor, activeId]);

  // מיקום: אחרי המדידה, ובכל גלילה/שינוי גודל (הקרט זז)
  const clientRect = menu?.clientRect ?? null;
  const itemCount = menu?.items.length ?? 0;
  useLayoutEffect(() => {
    const el = menuElRef.current;
    if (!isOpen || !el) return;

    const reposition = () => {
      const caret = clientRect?.();
      if (!caret) return;
      const isRtl = getComputedStyle(editor.view.dom).direction === "rtl";
      setPosition(
        computePosition(
          caret,
          { width: el.offsetWidth, height: el.scrollHeight },
          isRtl,
        ),
      );
    };

    reposition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [editor, isOpen, clientRect, itemCount]);

  // הפריט הפעיל תמיד גלוי בתוך הרשימה הנגללת
  useEffect(() => {
    if (!activeId) return;
    document.getElementById(activeId)?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  if (!menu) return null;

  return createPortal(
    <div
      ref={menuElRef}
      dir="rtl"
      // לחיצה על התפריט לא לוקחת פוקוס מהעורך
      onMouseDown={(event) => event.preventDefault()}
      style={{
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        maxHeight: position?.maxHeight,
        visibility: position ? "visible" : "hidden",
      }}
      className="fixed z-50 w-72 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg"
    >
      <span className="sr-only" role="status">
        {menu.items.length > 0
          ? `${menu.items.length} פקודות זמינות`
          : "לא נמצאו פקודות"}
      </span>
      <div
        id={SLASH_LISTBOX_ID}
        role="listbox"
        aria-label="פקודות עיצוב"
        className="flex flex-col"
      >
        {menu.items.map((item, index) => {
          const isActive = index === menu.activeIndex;
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              id={optionId(item.id)}
              role="option"
              aria-selected={isActive}
              onMouseEnter={() => onHover(index)}
              onClick={() => menu.select(item)}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5",
                isActive && "bg-primary-muted text-primary",
              )}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-background text-foreground">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-body-sm font-medium">{item.label}</span>
                <span className="truncate text-caption text-muted-foreground">
                  {item.description}
                </span>
              </span>
            </div>
          );
        })}
      </div>
      {menu.items.length === 0 && (
        <p className="px-3 py-2 text-body-sm text-muted-foreground">
          לא נמצאו פקודות
        </p>
      )}
    </div>,
    document.body,
  );
}
