"use client";

import type { SuggestionProps } from "@tiptap/suggestion";
import { useCallback, useMemo, useRef, useState } from "react";

import type { SlashSuggestionRender } from "./slash-command-extension";
import type { SlashCommand } from "./slash-commands";

export interface SlashMenuState {
  items: SlashCommand[];
  activeIndex: number;
  select: (command: SlashCommand) => void;
  clientRect: (() => DOMRect | null) | null;
}

type Props = SuggestionProps<SlashCommand, SlashCommand>;

function toMenuState(props: Props, activeIndex: number): SlashMenuState {
  return {
    items: props.items,
    activeIndex,
    select: props.command,
    clientRect: props.clientRect ?? null,
  };
}

/**
 * מחבר בין תוסף ה-suggestion (שקורא ל-render מחוץ ל-React) לבין מצב התפריט.
 * ה-ref הוא מקור האמת לטיפול סינכרוני בלחיצות מקשים; ה-state משמש לרינדור.
 */
export function useSlashMenu() {
  const [menu, setMenu] = useState<SlashMenuState | null>(null);
  const menuRef = useRef<SlashMenuState | null>(null);

  const commit = useCallback((next: SlashMenuState | null) => {
    menuRef.current = next;
    setMenu(next);
  }, []);

  const setActiveIndex = useCallback(
    (index: number) => {
      if (menuRef.current) commit({ ...menuRef.current, activeIndex: index });
    },
    [commit],
  );

  const render = useMemo<SlashSuggestionRender>(
    () => () => ({
      onStart: (props) => commit(toMenuState(props, 0)),
      // הסינון השתנה: חוזרים לפריט הראשון
      onUpdate: (props) => commit(toMenuState(props, 0)),
      onExit: () => commit(null),
      onKeyDown: ({ event }) => {
        const current = menuRef.current;
        if (!current || current.items.length === 0) return false;
        const count = current.items.length;

        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          const step = event.key === "ArrowDown" ? 1 : -1;
          setActiveIndex((current.activeIndex + step + count) % count);
          return true;
        }
        if (event.key === "Enter" || event.key === "Tab") {
          current.select(current.items[current.activeIndex]);
          return true;
        }
        return false;
      },
    }),
    [commit, setActiveIndex],
  );

  return { menu, render, setActiveIndex };
}
