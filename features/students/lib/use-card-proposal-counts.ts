"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";

import { createClient } from "@/lib/supabase/client";
import { describeSupabaseError } from "@/lib/supabase/describe-error";

/**
 * כמה הצעות הוצעו לכל כרטיס בעמוד של רשימת המיועדים. בקשה אחת לכל עמוד,
 * אחרי שהשורות עצמן נטענו (כמו התמונות, use-student-thumbnails.ts), כדי שהטבלה
 * לא תמתין לספירה. המסד מחליט מי רשאי לראות את המספר (can_see_card_proposals):
 * לכרטיס שאינו מותר לצופה חוזר null, ואז לא מוצג דבר.
 */
export const CARD_PROPOSAL_COUNTS_RPC = "get_card_proposal_counts";

/** כמה מזהים המסד מקבל בקריאה אחת (עמוד ברשימה הוא 50) */
const MAX_IDS_PER_CALL = 100;

const countsSchema = z.array(
  z.object({
    student_id: z.string(),
    proposal_count: z.number().int().nullable(),
  }),
);

export type CardProposalCounts = ReadonlyMap<string, number>;

const EMPTY: CardProposalCounts = new Map();

export function useCardProposalCounts(
  studentIds: readonly string[],
): CardProposalCounts {
  const supabaseRef = useRef(createClient());
  const [counts, setCounts] = useState<CardProposalCounts>(EMPTY);
  const idsKey = useMemo(
    () => [...new Set(studentIds)].slice(0, MAX_IDS_PER_CALL).join(","),
    [studentIds],
  );

  useEffect(() => {
    if (!idsKey) return;
    let isCurrent = true;
    void supabaseRef.current
      .rpc(CARD_PROPOSAL_COUNTS_RPC, { p_student_ids: idsKey.split(",") })
      .then(({ data, error }) => {
        if (!isCurrent) return;
        if (error) {
          console.error(
            "[students/proposal-counts] load failed",
            describeSupabaseError(error),
          );
          return;
        }
        const parsed = countsSchema.safeParse(data ?? []);
        if (!parsed.success) {
          console.error(
            "[students/proposal-counts] unexpected shape",
            parsed.error.issues,
          );
          return;
        }
        setCounts(
          new Map(
            parsed.data.flatMap((row) =>
              row.proposal_count === null
                ? []
                : [[row.student_id, row.proposal_count] as const],
            ),
          ),
        );
      });
    return () => {
      isCurrent = false;
    };
  }, [idsKey]);

  return idsKey ? counts : EMPTY;
}
