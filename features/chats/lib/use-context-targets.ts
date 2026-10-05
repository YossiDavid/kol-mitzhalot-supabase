"use client";

import * as React from "react";

import { createClient } from "@/lib/supabase/client";
import type { RoomContext } from "./room-context";

export type ContextCard = { id: string; name: string };

export type ContextTargets = {
  /** false עד שהבדיקה הסתיימה — כדי לא להציג "הוסר" לפני שנבדק */
  isLoaded: boolean;
  /** false עד שנבדק, ואחר כך true רק אם ההצעה קיימת וגלויה לי */
  hasProposal: boolean;
  /** הכרטיסים הקשורים להקשר שאני רשאי לראות (RLS), לפי הסדר: מיועד, מיועדת */
  cards: ContextCard[];
};

const LOADING: ContextTargets = {
  isLoaded: false,
  hasProposal: false,
  cards: [],
};
const NOTHING_FOUND: ContextTargets = { ...LOADING, isLoaded: true };

function cardName(row: {
  first_name: string | null;
  last_name: string | null;
}): string {
  return `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || "כרטיס";
}

/**
 * מה מהיעד של החדר עדיין קיים וגלוי לי. השאילתות רצות תחת ה-RLS שלי, ולכן
 * כרטיס שנמחק (soft delete) או הצעה שנמחקה פשוט לא חוזרים — ואז מציגים את
 * התווית בלי קישור, במקום קישור שמוביל ל-404.
 */
export function useContextTargets(context: RoomContext): ContextTargets {
  const supabase = React.useMemo(() => createClient(), []);
  const [targets, setTargets] = React.useState<{
    key: string;
    value: ContextTargets;
  } | null>(null);
  const key = `${context.kind}:${context.studentId}:${context.shidduchId}`;

  React.useEffect(() => {
    let isMounted = true;

    async function load(): Promise<ContextTargets> {
      if (context.kind === "student" && context.studentId) {
        const { data } = await supabase
          .from("students")
          .select("id, first_name, last_name")
          .eq("id", context.studentId)
          .maybeSingle();
        return {
          isLoaded: true,
          hasProposal: false,
          cards: data ? [{ id: data.id, name: cardName(data) }] : [],
        };
      }

      if (context.kind === "shidduch" && context.shidduchId) {
        const { data: shidduch } = await supabase
          .from("shidduchim")
          .select("id, groom_id, bride_id")
          .eq("id", context.shidduchId)
          .maybeSingle();
        if (!shidduch) return NOTHING_FOUND;

        const { data: students } = await supabase
          .from("students")
          .select("id, first_name, last_name")
          .in("id", [shidduch.groom_id, shidduch.bride_id]);
        const byId = new Map((students ?? []).map((s) => [s.id, s]));
        const cards = [shidduch.groom_id, shidduch.bride_id].flatMap((id) => {
          const row = byId.get(id);
          return row ? [{ id, name: cardName(row) }] : [];
        });
        return { isLoaded: true, hasProposal: true, cards };
      }

      return NOTHING_FOUND;
    }

    load()
      .catch((): ContextTargets => NOTHING_FOUND)
      .then((value) => {
        if (isMounted) setTargets({ key, value });
      });
    return () => {
      isMounted = false;
    };
    // context נגזר כולו מ-key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, supabase]);

  return targets?.key === key ? targets.value : LOADING;
}
