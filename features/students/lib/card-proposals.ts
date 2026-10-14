import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { describeSupabaseError } from "@/lib/supabase/describe-error";

/**
 * כמה הצעות הוצעו לכרטיס, ולמי מותר לראות מה. "הצעה שהוצעה לכרטיס" - אותה
 * הגדרה כמו בדוח ההצעות של המנהל: שליחה (shidduch_events) שהכרטיס הוא הצד
 * שקיבל אותה. טיוטה אינה נספרת.
 *   בעל הכרטיס - המספר בלבד.
 *   שדכן - המספר, וההצעות שהוא עצמו הציע לכרטיס.
 *   מנהל - המספר וכל ההצעות, עם שם השדכן.
 * כל השאר (איש צוות, הצד השני בהצעה, גולש, צופה בכרטיס בסיסי) - כלום. הכלל
 * נאכף במסד (get_card_proposal_count, get_my_card_proposals; shidduch_events
 * קריאה למנהל בלבד).
 */

export type CardProposalRow = {
  shidduchId: string;
  sentAt: string;
  otherName: string | null;
  status: string | null;
  shadchanName: string | null;
};

export type CardProposals = {
  total: number;
  /** null: הצופה רואה את המספר בלבד */
  rows: CardProposalRow[] | null;
  scope: "owner" | "shadchan" | "admin";
};

const LIST_LIMIT = 50;

const myRowsSchema = z.array(
  z.object({
    shidduch_id: z.string(),
    sent_at: z.string(),
    other_student_name: z.string().nullable(),
    status: z.string().nullable(),
  }),
);

const adminRowsSchema = z.array(
  z.object({
    shidduch_id: z.string(),
    created_at: z.string(),
    shadchan_name: z.string().nullable(),
    other_student_name: z.string().nullable(),
  }),
);

const statusRowsSchema = z.array(
  z.object({ id: z.string(), status: z.string() }),
);

export async function loadCardProposals(
  supabase: SupabaseClient,
  studentId: string,
  viewer: { userId: string; isAdmin: boolean; isShadchan: boolean },
): Promise<CardProposals | null> {
  const { data: total, error } = await supabase.rpc("get_card_proposal_count", {
    p_student_id: studentId,
  });
  if (error) {
    console.error(
      "[students/card-proposals] count failed",
      describeSupabaseError(error),
    );
    return null;
  }
  if (typeof total !== "number") return null;

  if (viewer.isAdmin) {
    const { data, error: listError } = await supabase
      .from("shidduch_events")
      .select("shidduch_id, created_at, shadchan_name, other_student_name")
      .eq("student_id", studentId)
      .eq("kind", "offer_sent")
      .order("created_at", { ascending: false })
      .limit(LIST_LIMIT);
    const parsed = adminRowsSchema.safeParse(data ?? []);
    if (listError || !parsed.success) {
      console.error("[students/card-proposals] admin list failed", listError);
      return { total, rows: null, scope: "admin" };
    }
    // הסטטוס הנוכחי של כל הצעה (הצעה שנמחקה נשארת ביומן, בלי סטטוס)
    const ids = [...new Set(parsed.data.map((row) => row.shidduch_id))];
    const { data: statusData } = ids.length
      ? await supabase.from("shidduchim").select("id, status").in("id", ids)
      : { data: [] };
    const statuses = new Map(
      (statusRowsSchema.safeParse(statusData ?? []).data ?? []).map((row) => [
        row.id,
        row.status,
      ]),
    );
    return {
      total,
      scope: "admin",
      rows: parsed.data.map((row) => ({
        shidduchId: row.shidduch_id,
        sentAt: row.created_at,
        otherName: row.other_student_name,
        status: statuses.get(row.shidduch_id) ?? null,
        shadchanName: row.shadchan_name,
      })),
    };
  }

  if (viewer.isShadchan) {
    const { data, error: listError } = await supabase.rpc(
      "get_my_card_proposals",
      { p_student_id: studentId },
    );
    const parsed = myRowsSchema.safeParse(data ?? []);
    if (listError || !parsed.success) {
      console.error("[students/card-proposals] own list failed", listError);
      return { total, rows: null, scope: "shadchan" };
    }
    return {
      total,
      scope: "shadchan",
      rows: parsed.data.map((row) => ({
        shidduchId: row.shidduch_id,
        sentAt: row.sent_at,
        otherName: row.other_student_name,
        status: row.status,
        shadchanName: null,
      })),
    };
  }

  return { total, rows: null, scope: "owner" };
}
