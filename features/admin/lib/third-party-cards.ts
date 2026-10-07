import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { describeSupabaseError } from "@/lib/supabase/describe-error";
import {
  describeAuthorRelation,
  readAuthorInfo,
} from "@/features/students/lib/author-info";

/**
 * תור הכרטיסים שמולאו על ידי צד שלישי, לאישור הנהלה
 * (/app/admin/third-party-cards). service role: הדף מנהל בלבד (admin/layout).
 */

export const THIRD_PARTY_CARDS_PAGE_SIZE = 25;
export const THIRD_PARTY_CARDS_PATH = "/app/admin/third-party-cards";

/** pending: ממתינים לאישור כלשהו (ברירת מחדל). all: כולם */
export type ThirdPartyCardsFilter = "pending" | "all";

export type ThirdPartyCardsQuery = {
  page: number;
  filter: ThirdPartyCardsFilter;
};

/** "ממתין": חסר אישור הצגת נתונים מלאים או אישור שליחת הצעות. משותף ללוח הבקרה */
export const THIRD_PARTY_PENDING_FILTER =
  "third_party_full_display_approved_at.is.null,third_party_proposals_approved_at.is.null";

const pageSchema = z.coerce.number().int().min(1).catch(1);

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseThirdPartyCardsQuery(
  params: Record<string, string | string[] | undefined>,
): ThirdPartyCardsQuery {
  return {
    page: pageSchema.parse(firstValue(params.page)),
    filter: firstValue(params.filter) === "all" ? "all" : "pending",
  };
}

export function thirdPartyCardsHref(query: ThirdPartyCardsQuery): string {
  const search = new URLSearchParams();
  if (query.filter === "all") search.set("filter", "all");
  if (query.page > 1) search.set("page", String(query.page));
  const text = search.toString();
  return text ? `${THIRD_PARTY_CARDS_PATH}?${text}` : THIRD_PARTY_CARDS_PATH;
}

const rowSchema = z.object({
  id: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  created_at: z.string().nullable(),
  author_info: z.unknown(),
  third_party_full_display_approved_at: z.string().nullable(),
  third_party_proposals_approved_at: z.string().nullable(),
});

export type ThirdPartyCardRow = {
  id: string;
  candidateName: string;
  createdAt: string | null;
  fillerName: string;
  fillerRelation: string;
  fillerPhone: string;
  knowsWell: boolean | null;
  fillReason: string;
  fullDisplayApprovedAt: string | null;
  proposalsApprovedAt: string | null;
};

export type ThirdPartyCardsPage = {
  rows: ThirdPartyCardRow[];
  total: number;
};

const COLUMNS =
  "id, first_name, last_name, created_at, author_info, third_party_full_display_approved_at, third_party_proposals_approved_at";

function toRow(raw: z.infer<typeof rowSchema>): ThirdPartyCardRow {
  const author = readAuthorInfo(raw.author_info, "other");
  return {
    id: raw.id,
    candidateName: `${raw.first_name} ${raw.last_name}`,
    createdAt: raw.created_at,
    fillerName: author.name,
    fillerRelation: describeAuthorRelation(author),
    fillerPhone: author.phone,
    knowsWell: author.knowsWell,
    fillReason: author.fillReason,
    fullDisplayApprovedAt: raw.third_party_full_display_approved_at,
    proposalsApprovedAt: raw.third_party_proposals_approved_at,
  };
}

export async function loadThirdPartyCards(
  query: ThirdPartyCardsQuery,
): Promise<ThirdPartyCardsPage> {
  const from = (query.page - 1) * THIRD_PARTY_CARDS_PAGE_SIZE;
  const to = from + THIRD_PARTY_CARDS_PAGE_SIZE - 1;

  let builder = createAdminClient()
    .from("students")
    .select(COLUMNS, { count: "exact" })
    .eq("card_for", "other")
    .is("deleted_at", null);
  if (query.filter === "pending") {
    builder = builder.or(THIRD_PARTY_PENDING_FILTER);
  }

  const { data, error, count } = await builder
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    console.error(
      "[admin/third-party-cards] load failed",
      describeSupabaseError(error),
    );
    throw new Error("טעינת הכרטיסים נכשלה");
  }

  const parsed = z.array(rowSchema).safeParse(data ?? []);
  if (!parsed.success) {
    console.error(
      "[admin/third-party-cards] unexpected row shape",
      parsed.error.issues,
    );
    throw new Error("טעינת הכרטיסים נכשלה");
  }
  return { rows: parsed.data.map(toRow), total: count ?? 0 };
}
