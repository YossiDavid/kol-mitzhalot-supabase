import { z } from "zod";

import type { createClient } from "@/lib/supabase/server";
import { describeSupabaseError } from "@/lib/supabase/describe-error";
import type { ShidduchSide } from "@/features/shidduchim/lib/responses";
import {
  SHIDDUCH_STATUS_VALUES,
  type ShidduchStatus,
} from "@/features/shidduchim/lib/status";

/**
 * הצעות השידוך מצד השדכן שיצר אותן — לרשימת "כל השידוכים שלי", לדף
 * ההצעות השמורות ולכרטיסי הדשבורד. קוד שרת בלבד, עם client של המשתמש
 * המחובר כדי שה-RLS יחול.
 */

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

export type RecipientScope = "both" | "groom_only" | "bride_only";

export interface ProposalPerson {
  firstName: string | null;
  lastName: string | null;
  birthDate: string | null;
  city: string | null;
}

export interface ShadchanProposal {
  id: string;
  status: ShidduchStatus;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
  /** NULL בטיוטה, או כשהמייל נכשל והשליחה בוטלה */
  recipientScope: RecipientScope | null;
  groomId: string;
  brideId: string;
  noteForGroom: string | null;
  noteForBride: string | null;
  groom: ProposalPerson | null;
  bride: ProposalPerson | null;
}

export type ProposalKind = "sent" | "draft";

export interface ShadchanProposalsResult {
  proposals: ShadchanProposal[];
  /** השליפה נכשלה — כדי שהדף יציג שגיאה ולא "אין הצעות" מטעה */
  failed: boolean;
}

const nullableText = z.string().nullable();

/** embed של PostgREST יכול לחזור כאובייקט או כמערך בן איבר אחד */
const unwrapEmbed = (value: unknown) =>
  Array.isArray(value) ? (value[0] ?? null) : value;

const personRowSchema = z.object({
  first_name: nullableText,
  last_name: nullableText,
  birth_date: nullableText.optional(),
  city: nullableText,
});

const proposalRowSchema = z.object({
  id: z.string(),
  status: z.enum(SHIDDUCH_STATUS_VALUES),
  created_at: z.string(),
  updated_at: z.string(),
  sent_at: nullableText,
  recipient_scope: z.enum(["both", "groom_only", "bride_only"]).nullable(),
  groom_id: z.string(),
  bride_id: z.string(),
  note_for_groom: nullableText,
  note_for_bride: nullableText,
  groom: z.preprocess(unwrapEmbed, personRowSchema.nullable()),
  bride: z.preprocess(unwrapEmbed, personRowSchema.nullable()),
});

const SHADCHAN_PROPOSAL_SELECT = `
  id,
  status,
  created_at,
  updated_at,
  sent_at,
  recipient_scope,
  groom_id,
  bride_id,
  note_for_groom,
  note_for_bride,
  groom:students!shidduchim_groom_id_fkey(first_name,last_name,birth_date,city),
  bride:students!shidduchim_bride_id_fkey(first_name,last_name,birth_date,city)
`;

function toPerson(
  row: z.infer<typeof personRowSchema> | null,
): ProposalPerson | null {
  if (!row) return null;
  return {
    firstName: row.first_name,
    lastName: row.last_name,
    birthDate: row.birth_date ?? null,
    city: row.city,
  };
}

/**
 * מאמת ומתרגם שורות shidduchim. שורה פגומה נרשמת ומדולגת, כדי שהיא
 * לא תעלים את כל הרשימה.
 */
export function parseShadchanProposalRows(
  rows: readonly unknown[],
): ShadchanProposal[] {
  return rows.flatMap((raw) => {
    const parsed = proposalRowSchema.safeParse(raw);
    if (!parsed.success) {
      console.error(
        "[shadchan-proposals] unexpected shidduchim row shape",
        parsed.error.issues,
      );
      return [];
    }
    const row = parsed.data;
    return [
      {
        id: row.id,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        sentAt: row.sent_at,
        recipientScope: row.recipient_scope,
        groomId: row.groom_id,
        brideId: row.bride_id,
        noteForGroom: row.note_for_groom,
        noteForBride: row.note_for_bride,
        groom: toPerson(row.groom),
        bride: toPerson(row.bride),
      },
    ];
  });
}

/** הצעות שנשלחו (החדשות קודם) או טיוטות (האחרונות שנערכו קודם) */
export async function getShadchanProposals(
  supabase: ServerSupabase,
  shadchanId: string,
  kind: ProposalKind,
): Promise<ShadchanProposalsResult> {
  const base = supabase
    .from("shidduchim")
    .select(SHADCHAN_PROPOSAL_SELECT)
    .eq("shadchan_id", shadchanId);

  const query =
    kind === "draft"
      ? base.eq("status", "draft").order("updated_at", { ascending: false })
      : base
          .neq("status", "draft")
          .order("sent_at", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error(
      `[shadchan-proposals] ${kind} select failed`,
      describeSupabaseError(error),
    );
    return { proposals: [], failed: true };
  }

  return { proposals: parseShadchanProposalRows(data ?? []), failed: false };
}

/** מספר הטיוטות של השדכן, לקישור "הצעות שמורות (N)". 0 גם בשגיאה. */
export async function countShadchanDrafts(
  supabase: ServerSupabase,
  shadchanId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("shidduchim")
    .select("id", { count: "exact", head: true })
    .eq("shadchan_id", shadchanId)
    .eq("status", "draft");

  if (error) {
    console.error(
      "[shadchan-proposals] drafts count failed",
      describeSupabaseError(error),
    );
    return 0;
  }

  return count ?? 0;
}

/** האם הצד היה נמען של ההצעה — אותו כלל כמו ב-RLS וב-SideResponsesPanel */
export function wasSentToSide(
  side: ShidduchSide,
  scope: RecipientScope | null,
): boolean {
  return scope === "both" || scope === `${side}_only`;
}
