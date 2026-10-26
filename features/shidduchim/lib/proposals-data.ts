import { z } from "zod";

import type { createClient } from "@/lib/supabase/server";
import { describeSupabaseError } from "@/lib/supabase/describe-error";
import {
  fetchPageClamped,
  isRangeNotSatisfiable,
  type PagedResult,
} from "@/lib/pagination";
import {
  SHIDDUCH_RESPONSE_VALUES,
  SHIDDUCH_SIDES,
  type ShidduchResponse,
  type ShidduchSide,
} from "@/features/shidduchim/lib/responses";
import {
  SHIDDUCH_STATUS_VALUES,
  type ShidduchStatus,
} from "@/features/shidduchim/lib/status";

/**
 * שליפת הצעות השידוך מצד ההורה ותגובות הצדדים מצד השדכן. לשימוש בקוד
 * שרת בלבד (Server Components / routes) עם client של המשתמש המחובר, כדי
 * ש-auth.uid() וה-RLS יחולו.
 */

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

const nullableText = z.string().nullable();

/** שורה מ-public.get_my_shidduch_proposals - מאומתת כי זה מידע חיצוני */
const proposalRowSchema = z.object({
  shidduch_id: z.string(),
  side: z.enum(SHIDDUCH_SIDES),
  status: z.enum(SHIDDUCH_STATUS_VALUES),
  shadchan_id: z.string(),
  shadchan_first_name: nullableText,
  shadchan_last_name: nullableText,
  note: nullableText,
  sent_at: nullableText,
  created_at: z.string(),
  my_student_id: z.string(),
  my_first_name: nullableText,
  my_last_name: nullableText,
  other_student_id: nullableText,
  other_first_name: nullableText,
  other_last_name: nullableText,
  other_city: nullableText,
  other_birth_date: nullableText,
  my_response: z.enum(SHIDDUCH_RESPONSE_VALUES).nullable(),
  my_response_message: nullableText,
  my_responded_at: nullableText,
});

type ProposalRow = z.infer<typeof proposalRowSchema>;

export type ParentProposal = {
  shidduchId: string;
  side: ShidduchSide;
  status: ShidduchStatus;
  shadchanId: string;
  shadchanFirstName: string | null;
  shadchanLastName: string | null;
  /** ההערה של השדכן לצד של המשתמש בלבד */
  note: string | null;
  sentAt: string | null;
  createdAt: string;
  myStudentId: string;
  myFirstName: string | null;
  myLastName: string | null;
  otherStudentId: string | null;
  otherFirstName: string | null;
  otherLastName: string | null;
  otherCity: string | null;
  otherBirthDate: string | null;
  myResponse: ShidduchResponse | null;
  myResponseMessage: string | null;
  myRespondedAt: string | null;
};

function toParentProposal(row: ProposalRow): ParentProposal {
  return {
    shidduchId: row.shidduch_id,
    side: row.side,
    status: row.status,
    shadchanId: row.shadchan_id,
    shadchanFirstName: row.shadchan_first_name,
    shadchanLastName: row.shadchan_last_name,
    note: row.note,
    sentAt: row.sent_at,
    createdAt: row.created_at,
    myStudentId: row.my_student_id,
    myFirstName: row.my_first_name,
    myLastName: row.my_last_name,
    otherStudentId: row.other_student_id,
    otherFirstName: row.other_first_name,
    otherLastName: row.other_last_name,
    otherCity: row.other_city,
    otherBirthDate: row.other_birth_date,
    myResponse: row.my_response,
    myResponseMessage: row.my_response_message,
    myRespondedAt: row.my_responded_at,
  };
}

type GetMyProposalsOptions = {
  shidduchId?: string;
  openOnly?: boolean;
  limit?: number;
};

export type MyProposalsResult = {
  proposals: ParentProposal[];
  /** השליפה נכשלה (או חזרה במבנה לא צפוי): לא להציג כ"אין הצעות" */
  failed: boolean;
};

/**
 * ההצעות שנשלחו למשתמש כמנהל כרטיס - שורה לכל צד שלו בשידוך. במקרה של
 * שגיאה מחזירה רשימה ריקה עם failed (אחרי רישום), כדי שתקלה בקטע אחד לא
 * תפיל את כל הדף, והקורא יבחין בין כישלון ל"אין הצעות".
 */
export async function getMyProposals(
  supabase: ServerSupabase,
  { shidduchId, openOnly = false, limit }: GetMyProposalsOptions = {},
): Promise<MyProposalsResult> {
  const { data, error } = await supabase.rpc("get_my_shidduch_proposals", {
    p_shidduch_id: shidduchId ?? null,
    p_open_only: openOnly,
    p_limit: limit ?? null,
  });

  if (error) {
    console.error(
      "[proposals] get_my_shidduch_proposals failed",
      describeSupabaseError(error),
    );
    return { proposals: [], failed: true };
  }

  const parsed = z.array(proposalRowSchema).safeParse(data ?? []);
  if (!parsed.success) {
    console.error(
      "[proposals] unexpected get_my_shidduch_proposals shape",
      parsed.error.issues,
    );
    return { proposals: [], failed: true };
  }

  return { proposals: parsed.data.map(toParentProposal), failed: false };
}

/** הסטטוסים של הצעה פתוחה - זהים ל-p_open_only ב-get_my_shidduch_proposals */
const OPEN_PROPOSAL_STATUSES: ReadonlySet<string> = new Set([
  "sent",
  "waiting_response",
  "interested",
  "more_info_needed",
  "in_progress",
]);

const RECENTLY_CLOSED_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * פיצול ההצעות של מנהל הכרטיס לפתוחות ולשנסגרו לאחרונה (30 יום), כדי
 * שהצעה שנדחתה - גם בידי הצד השני - לא תיעלם ממסך הבית בלי הסבר.
 */
export function splitProposalsForDashboard(
  proposals: readonly ParentProposal[],
  {
    openLimit,
    closedLimit,
    now = new Date(),
  }: {
    openLimit: number;
    closedLimit: number;
    now?: Date;
  },
): { open: ParentProposal[]; recentlyClosed: ParentProposal[] } {
  const since = now.getTime() - RECENTLY_CLOSED_DAYS * DAY_MS;
  const open = proposals.filter((p) => OPEN_PROPOSAL_STATUSES.has(p.status));
  const recentlyClosed = proposals.filter((p) => {
    if (OPEN_PROPOSAL_STATUSES.has(p.status)) return false;
    const at = new Date(p.sentAt ?? p.createdAt).getTime();
    return Number.isFinite(at) && at >= since;
  });
  return {
    open: open.slice(0, openLimit),
    recentlyClosed: recentlyClosed.slice(0, closedLimit),
  };
}

/** כמה הצעות בעמוד ב"הצעות שקיבלתי" */
export const PROPOSALS_PAGE_SIZE = 20;

export type MyProposalsPage = {
  proposals: ParentProposal[];
  /** כל ההצעות של המשתמש (כל העמודים) */
  total: number;
  /** העמוד שהוחזר בפועל; קטן מהמבוקש כשהמבוקש היה אחרי הסוף */
  page: number;
  failed: boolean;
};

/**
 * עמוד אחד מההצעות שנשלחו למשתמש. הפונקציה get_my_shidduch_proposals כבר
 * ממיינת דטרמיניסטית (החדשות קודם, ואז id וצד), ו-PostgREST מחיל את הטווח
 * על התוצאה שלה - בלי שינוי סכמה. עמוד אחרי הסוף מתכווץ לעמוד האחרון.
 */
export async function getMyProposalsPage(
  supabase: ServerSupabase,
  requestedPage: number,
): Promise<MyProposalsPage> {
  const result: PagedResult<ParentProposal> = await fetchPageClamped(
    requestedPage,
    PROPOSALS_PAGE_SIZE,
    async ({ from, to }) => {
      const { data, error, count } = await supabase
        .rpc(
          "get_my_shidduch_proposals",
          { p_shidduch_id: null, p_open_only: false, p_limit: null },
          { count: "exact" },
        )
        .range(from, to);

      if (isRangeNotSatisfiable(error)) {
        return { rows: [], total: 0, failed: false, isOutOfRange: true };
      }
      if (error) {
        console.error(
          "[proposals] get_my_shidduch_proposals page failed",
          describeSupabaseError(error),
        );
        return { rows: [], total: 0, failed: true };
      }

      const parsed = z.array(proposalRowSchema).safeParse(data ?? []);
      if (!parsed.success) {
        console.error(
          "[proposals] unexpected get_my_shidduch_proposals shape",
          parsed.error.issues,
        );
        return { rows: [], total: 0, failed: true };
      }
      return {
        rows: parsed.data.map(toParentProposal),
        total: count ?? parsed.data.length,
        failed: false,
      };
    },
  );

  return {
    proposals: result.rows,
    total: result.total,
    page: result.page,
    failed: result.failed,
  };
}

const sideResponseRowSchema = z.object({
  shidduch_id: z.string(),
  side: z.enum(SHIDDUCH_SIDES),
  response: z.enum(SHIDDUCH_RESPONSE_VALUES),
  message: nullableText,
  created_at: z.string(),
  updated_at: z.string(),
});

export type SideResponse = {
  shidduchId: string;
  side: ShidduchSide;
  response: ShidduchResponse;
  message: string | null;
  firstRespondedAt: string;
  respondedAt: string;
};

/**
 * תגובות הצדדים לשידוכים של השדכן. ה-RLS מחזיר לשדכן את כל התגובות
 * לשידוכים שלו, למנהל את הכל, ולהורה רק את הצד שלו.
 */
export async function getSideResponses(
  supabase: ServerSupabase,
  shidduchIds: readonly string[],
): Promise<SideResponse[]> {
  if (shidduchIds.length === 0) return [];

  const { data, error } = await supabase
    .from("shidduch_responses")
    .select("shidduch_id, side, response, message, created_at, updated_at")
    .in("shidduch_id", [...shidduchIds]);

  if (error) {
    console.error(
      "[proposals] shidduch_responses select failed",
      describeSupabaseError(error),
    );
    return [];
  }

  const parsed = z.array(sideResponseRowSchema).safeParse(data ?? []);
  if (!parsed.success) {
    console.error(
      "[proposals] unexpected shidduch_responses shape",
      parsed.error.issues,
    );
    return [];
  }

  return parsed.data.map((row) => ({
    shidduchId: row.shidduch_id,
    side: row.side,
    response: row.response,
    message: row.message,
    firstRespondedAt: row.created_at,
    respondedAt: row.updated_at,
  }));
}
