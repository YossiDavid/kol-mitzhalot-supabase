import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { describeSupabaseError } from "@/lib/supabase/describe-error";
import {
  describeAuthorRelation,
  readAuthorInfo,
} from "@/features/students/lib/author-info";
import {
  NEW_CARDS_PATH,
  cardApprovalStatus,
  type CardApprovalStatus,
} from "@/features/students/lib/card-approval";

/**
 * תור הכרטיסים שממתינים לאישור הנהלה (/app/admin/new-cards). service role:
 * הדף מנהל בלבד (admin/layout).
 */

export const NEW_CARDS_PAGE_SIZE = 25;

/** pending: ממתינים (ברירת מחדל). rejected: נדחו. approved: אושרו לאחרונה */
export type NewCardsFilter = "pending" | "rejected" | "approved";

export const NEW_CARDS_FILTER_LABELS: Record<NewCardsFilter, string> = {
  pending: "ממתינים לאישור",
  rejected: "נדחו",
  approved: "אושרו לאחרונה",
};

export type NewCardsQuery = {
  page: number;
  filter: NewCardsFilter;
};

const pageSchema = z.coerce.number().int().min(1).catch(1);
const filterSchema = z
  .enum(["pending", "rejected", "approved"])
  .catch("pending");

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseNewCardsQuery(
  params: Record<string, string | string[] | undefined>,
): NewCardsQuery {
  return {
    page: pageSchema.parse(firstValue(params.page)),
    filter: filterSchema.parse(firstValue(params.filter)),
  };
}

export function newCardsHref(query: NewCardsQuery): string {
  const search = new URLSearchParams();
  if (query.filter !== "pending") search.set("filter", query.filter);
  if (query.page > 1) search.set("page", String(query.page));
  const text = search.toString();
  return text ? `${NEW_CARDS_PATH}?${text}` : NEW_CARDS_PATH;
}

const rowSchema = z.object({
  id: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  created_at: z.string().nullable(),
  card_for: z.string().nullable(),
  author_info: z.unknown(),
  admin_approved_at: z.string().nullable(),
  admin_rejected_at: z.string().nullable(),
  admin_rejection_reason: z.string().nullable(),
  admin_exclusive_at: z.string().nullable(),
  third_party_full_display_approved_at: z.string().nullable(),
  third_party_proposals_approved_at: z.string().nullable(),
});

export type NewCardRow = {
  id: string;
  candidateName: string;
  createdAt: string | null;
  cardFor: string | null;
  fillerName: string;
  fillerRelation: string;
  fillerPhone: string;
  fillerEmail: string;
  status: CardApprovalStatus;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  thirdPartyFullDisplayApprovedAt: string | null;
  thirdPartyProposalsApprovedAt: string | null;
};

export type NewCardsPage = {
  rows: NewCardRow[];
  total: number;
};

const COLUMNS =
  "id, first_name, last_name, created_at, card_for, author_info, admin_approved_at, admin_rejected_at, admin_rejection_reason, admin_exclusive_at, third_party_full_display_approved_at, third_party_proposals_approved_at";

function toRow(raw: z.infer<typeof rowSchema>): NewCardRow {
  const author = readAuthorInfo(raw.author_info, raw.card_for);
  return {
    id: raw.id,
    candidateName: `${raw.first_name} ${raw.last_name}`,
    createdAt: raw.created_at,
    cardFor: raw.card_for,
    fillerName: author.name,
    fillerRelation: describeAuthorRelation(author),
    fillerPhone: author.phone,
    fillerEmail: author.email,
    status: cardApprovalStatus(raw),
    approvedAt: raw.admin_approved_at,
    rejectedAt: raw.admin_rejected_at,
    rejectionReason: raw.admin_rejection_reason,
    thirdPartyFullDisplayApprovedAt: raw.third_party_full_display_approved_at,
    thirdPartyProposalsApprovedAt: raw.third_party_proposals_approved_at,
  };
}

/**
 * "ממתין": לא מאושר ולא נדחה, ולא נמחק. אותה הגדרה משמשת את הספירה בלוח
 * הבקרה (dashboard-stats.ts), כדי שהמספר שם יהיה זהה לרשימה כאן.
 */
export function pendingNewCards<
  B extends {
    is(column: string, value: null): B;
  },
>(builder: B): B {
  return builder
    .is("deleted_at", null)
    .is("admin_approved_at", null)
    .is("admin_rejected_at", null);
}

type FilterableQuery<B> = {
  is(column: string, value: null): B;
  not(column: string, operator: string, value: null): B;
};

/** הכרטיסים של כל לשונית. משמש גם את הרשימה וגם את הספירה שעל הלשוניות */
function applyNewCardsFilter<B extends FilterableQuery<B>>(
  builder: B,
  filter: NewCardsFilter,
): B {
  if (filter === "pending") return pendingNewCards(builder);
  if (filter === "rejected") {
    return builder.is("deleted_at", null).not("admin_rejected_at", "is", null);
  }
  // רק כרטיסים שמנהל אישר בפועל; כרטיסים מלפני ההטמעה אושרו בלי מאשר
  return builder.is("deleted_at", null).not("admin_approved_by", "is", null);
}

/** עמודת המיון של כל לשונית: החדש קודם */
const ORDER_COLUMN: Record<NewCardsFilter, string> = {
  pending: "created_at",
  rejected: "admin_rejected_at",
  approved: "admin_approved_at",
};

const NEW_CARDS_FILTERS: readonly NewCardsFilter[] = [
  "pending",
  "rejected",
  "approved",
];

/**
 * כמה כרטיסים בכל לשונית - כדי שכרטיס שנדחה לא "ייעלם" מעיני המנהל: הוא
 * ממתין בלשונית "נדחו", והמספר שעליה מראה זאת. null - הספירה נכשלה.
 */
export async function loadNewCardsCounts(): Promise<
  Record<NewCardsFilter, number | null>
> {
  const admin = createAdminClient();
  const counts = await Promise.all(
    NEW_CARDS_FILTERS.map(async (filter) => {
      const { count, error } = await applyNewCardsFilter(
        admin.from("students").select("id", { count: "exact", head: true }),
        filter,
      );
      if (error) {
        console.error(
          "[admin/new-cards] count failed",
          filter,
          describeSupabaseError(error),
        );
        return [filter, null] as const;
      }
      return [filter, count ?? 0] as const;
    }),
  );
  return Object.fromEntries(counts) as Record<NewCardsFilter, number | null>;
}

export async function loadNewCards(
  query: NewCardsQuery,
): Promise<NewCardsPage> {
  const from = (query.page - 1) * NEW_CARDS_PAGE_SIZE;
  const to = from + NEW_CARDS_PAGE_SIZE - 1;

  const base = createAdminClient()
    .from("students")
    .select(COLUMNS, { count: "exact" });

  const request = applyNewCardsFilter(base, query.filter).order(
    ORDER_COLUMN[query.filter],
    { ascending: false },
  );

  const { data, error, count } = await request.range(from, to);

  if (error) {
    console.error(
      "[admin/new-cards] load failed",
      describeSupabaseError(error),
    );
    throw new Error("טעינת הכרטיסים נכשלה");
  }

  const parsed = z.array(rowSchema).safeParse(data ?? []);
  if (!parsed.success) {
    console.error(
      "[admin/new-cards] unexpected row shape",
      parsed.error.issues,
    );
    throw new Error("טעינת הכרטיסים נכשלה");
  }
  return { rows: parsed.data.map(toRow), total: count ?? 0 };
}
