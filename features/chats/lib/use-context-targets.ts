"use client";

import * as React from "react";
import { z } from "zod";

import { STUDENT_CARDS_VIEW } from "@/features/students/lib/third-party-card";
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

/** שורת get_my_shidduch_proposals: הצד שלי, הכרטיס שלי והכרטיס של הצד השני */
const myProposalRowsSchema = z.array(
  z.object({
    side: z.enum(["groom", "bride"]),
    my_student_id: z.string().nullable(),
    my_first_name: z.string().nullable(),
    my_last_name: z.string().nullable(),
    other_student_id: z.string().nullable(),
    other_first_name: z.string().nullable(),
    other_last_name: z.string().nullable(),
  }),
);

/**
 * הכרטיסים של הצעה שנשלחה אליי, בסדר חתן-כלה. מנהל כרטיס (הורה) אינו קורא
 * את שורת shidduchim ואת שורת הכרטיס של הצד השני; get_my_shidduch_proposals
 * מחזירה לו בדיוק מה שמותר: ההצעה, הצד שלו ושמות שני הכרטיסים. ריק - אין
 * הצעה כזו שנשלחה לצד שלי (או שנמחקה).
 */
async function loadMyProposalCards(
  supabase: ReturnType<typeof createClient>,
  shidduchId: string,
): Promise<ContextCard[] | null> {
  const { data, error } = await supabase.rpc("get_my_shidduch_proposals", {
    p_shidduch_id: shidduchId,
  });
  if (error) return null;
  const parsed = myProposalRowsSchema.safeParse(data ?? []);
  if (!parsed.success || parsed.data.length === 0) return null;

  const byId = new Map<string, { name: string; isGroom: boolean }>();
  for (const row of parsed.data) {
    const mine = { id: row.my_student_id, isGroom: row.side === "groom" };
    const other = { id: row.other_student_id, isGroom: row.side !== "groom" };
    if (mine.id) {
      byId.set(mine.id, {
        isGroom: mine.isGroom,
        name: cardName({
          first_name: row.my_first_name,
          last_name: row.my_last_name,
        }),
      });
    }
    if (other.id && !byId.has(other.id)) {
      byId.set(other.id, {
        isGroom: other.isGroom,
        name: cardName({
          first_name: row.other_first_name,
          last_name: row.other_last_name,
        }),
      });
    }
  }
  return [...byId.entries()]
    .sort(([, a], [, b]) => Number(b.isGroom) - Number(a.isGroom))
    .map(([id, card]) => ({ id, name: card.name }));
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
          .from(STUDENT_CARDS_VIEW)
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
        // שדכן ההצעה ומנהל קוראים את שורת ההצעה עצמה
        const { data: shidduch } = await supabase
          .from("shidduchim")
          .select("id, groom_id, bride_id")
          .eq("id", context.shidduchId)
          .maybeSingle();
        if (!shidduch) {
          // מנהל כרטיס (הורה): ההצעה והכרטיסים מגיעים מהפונקציה שמחזירה לו
          // רק את מה שמותר לו
          const cards = await loadMyProposalCards(supabase, context.shidduchId);
          return cards
            ? { isLoaded: true, hasProposal: true, cards }
            : NOTHING_FOUND;
        }

        const sideIds: string[] = [shidduch.groom_id, shidduch.bride_id];
        const { data: students } = await supabase
          .from(STUDENT_CARDS_VIEW)
          .select("id, first_name, last_name")
          .in("id", sideIds);
        const byId = new Map(
          (students ?? []).map((s) => [s.id as string, cardName(s)]),
        );
        const cards = sideIds.flatMap((id) => {
          const name = byId.get(id);
          return name ? [{ id, name }] : [];
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
