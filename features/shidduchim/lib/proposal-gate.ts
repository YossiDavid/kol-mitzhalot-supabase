import { z } from "zod";

import type { SupabaseClient } from "@supabase/supabase-js";

import { describeSupabaseError } from "@/lib/supabase/describe-error";
import {
  THIRD_PARTY_BLOCK_CODE,
  THIRD_PARTY_PROPOSAL_MESSAGE,
  isProposalsPending,
} from "@/features/students/lib/third-party-card";

/**
 * האם כרטיס רשאי לקבל הצעה חדשה: לא מושהה, ולא מיצה את המכסה שקבע מנהל
 * הכרטיס. הבדיקה רצה ב-routes לפני שליחת המייל (כדי שההודעה תהיה ברורה
 * והמייל לא יצא), והטריגר enforce_shidduch_card_gates במסד הוא השכבה
 * שאי אפשר לעקוף. מקור הנתונים לשניהם: student_proposal_quota.
 *
 * כשל בבדיקה זורק - עדיף לסרב לשליחה מאשר להתיר אותה בגלל שגיאה.
 */

export type ProposalSide = "groom" | "bride";

export type ProposalBlockCode =
  | "card_paused"
  | "proposal_limit_reached"
  | typeof THIRD_PARTY_BLOCK_CODE;

export type ProposalBlock = {
  code: ProposalBlockCode;
  side: ProposalSide;
  message: string;
};

const MS_PER_HOUR = 60 * 60 * 1000;
const HOURS_PER_DAY = 24;

const SIDE_LABELS: Record<ProposalSide, string> = {
  groom: "כרטיס המיועד",
  bride: "כרטיס המיועדת",
};

/** שורה מ-public.student_proposal_quota - מאומתת כי היא מידע חיצוני */
const quotaRowSchema = z.object({
  is_paused: z.boolean(),
  limit_count: z.number().nullable(),
  used_count: z.number(),
  retry_at: z.string().nullable(),
});

/** "בעוד שעה" / "בעוד 5 שעות" / "בעוד יום" / "בעוד 3 ימים" - שעות מתחת ליום */
export function formatRetryAfter(retryAt: Date, now: Date = new Date()) {
  const remainingMs = Math.max(retryAt.getTime() - now.getTime(), 0);
  const hours = Math.max(Math.ceil(remainingMs / MS_PER_HOUR), 1);

  if (hours < HOURS_PER_DAY) {
    return hours === 1 ? "בעוד שעה" : `בעוד ${hours} שעות`;
  }
  const days = Math.ceil(hours / HOURS_PER_DAY);
  return days === 1 ? "בעוד יום" : `בעוד ${days} ימים`;
}

function pausedMessage(side: ProposalSide) {
  return `${SIDE_LABELS[side]} מושהה כרגע ואינו מקבל הצעות`;
}

function limitMessage(side: ProposalSide, retryAt: string | null) {
  const base = `${SIDE_LABELS[side]} הגיע למכסת ההצעות שקבע מנהל הכרטיס.`;
  if (!retryAt) return base;
  return `${base} מומלץ לנסות שוב ${formatRetryAfter(new Date(retryAt))}.`;
}

async function blockForCard(
  admin: SupabaseClient,
  side: ProposalSide,
  studentId: string,
): Promise<ProposalBlock | null> {
  const { data, error } = await admin.rpc("student_proposal_quota", {
    p_student_id: studentId,
  });

  if (error) {
    console.error(
      "[shidduchim/gate] student_proposal_quota failed",
      studentId,
      describeSupabaseError(error),
    );
    throw new Error("בדיקת מכסת ההצעות נכשלה");
  }

  const parsed = z.array(quotaRowSchema).safeParse(data ?? []);
  if (!parsed.success) {
    console.error(
      "[shidduchim/gate] unexpected student_proposal_quota shape",
      parsed.error.issues,
    );
    throw new Error("בדיקת מכסת ההצעות נכשלה");
  }

  const quota = parsed.data[0];
  if (!quota) return null;

  if (quota.is_paused) {
    return { code: "card_paused", side, message: pausedMessage(side) };
  }

  const isLimitReached =
    quota.limit_count !== null && quota.used_count >= quota.limit_count;
  if (isLimitReached) {
    return {
      code: "proposal_limit_reached",
      side,
      message: limitMessage(side, quota.retry_at),
    };
  }

  return null;
}

/**
 * כרטיס שמולא על ידי צד שלישי וטרם אושר לקבלת הצעות. נבדקים שני הכרטיסים של
 * ההצעה, בלי קשר להיקף השליחה: אם אחד מהם חסום, כל השליחה נדחית (כמו הטריגר).
 */
export async function findThirdPartyBlocks(
  admin: SupabaseClient,
  groomId: string,
  brideId: string,
): Promise<ProposalBlock[]> {
  const { data, error } = await admin
    .from("students")
    .select("id, card_for, third_party_proposals_approved_at")
    .in("id", [groomId, brideId]);

  if (error) {
    console.error(
      "[shidduchim/gate] third-party lookup failed",
      describeSupabaseError(error),
    );
    throw new Error("בדיקת סוג הכרטיס נכשלה");
  }

  const pending = new Set(
    (data ?? []).filter((card) => isProposalsPending(card)).map((c) => c.id),
  );
  const sides: Array<[ProposalSide, string]> = [
    ["groom", groomId],
    ["bride", brideId],
  ];
  return sides
    .filter(([, id]) => pending.has(id))
    .map(([side]) => ({
      code: THIRD_PARTY_BLOCK_CODE,
      side,
      message: THIRD_PARTY_PROPOSAL_MESSAGE,
    }));
}

/** הצדדים שעתידים לקבל הצעה חדשה - ההפרעות שנמצאו, לפי סדר חתן-כלה */
export async function findProposalBlocks(
  admin: SupabaseClient,
  cards: ReadonlyArray<{ side: ProposalSide; studentId: string }>,
): Promise<ProposalBlock[]> {
  const results = await Promise.all(
    cards.map((card) => blockForCard(admin, card.side, card.studentId)),
  );
  return results.filter((block): block is ProposalBlock => block !== null);
}

/** גוף תשובת הסירוב: ההודעות של כל הצדדים החסומים יחד, והקוד הראשון */
export function proposalBlocksBody(blocks: readonly ProposalBlock[]) {
  return {
    error: Array.from(new Set(blocks.map((block) => block.message))).join(" "),
    code: blocks[0].code,
    sides: blocks.map((block) => block.side),
  };
}

/**
 * סירוב שהטריגר במסד העלה (race בין הבדיקה ב-route לכתיבה), כהודעה למשתמש.
 * null כשהשגיאה אינה סירוב מכסה/השהיה.
 */
export function dbBlockFromError(
  error: { message?: string; details?: string | null } | null,
): ProposalBlock | null {
  const message = error?.message ?? "";
  const side: ProposalSide = error?.details === "bride" ? "bride" : "groom";

  if (message.includes(THIRD_PARTY_BLOCK_CODE)) {
    return {
      code: THIRD_PARTY_BLOCK_CODE,
      side,
      message: THIRD_PARTY_PROPOSAL_MESSAGE,
    };
  }
  if (message.includes("card_paused")) {
    return { code: "card_paused", side, message: pausedMessage(side) };
  }
  if (message.includes("proposal_limit_reached")) {
    return {
      code: "proposal_limit_reached",
      side,
      message: limitMessage(side, null),
    };
  }
  return null;
}

/** הצדדים שההיקף כולל, עם מזהה הכרטיס של כל אחד */
export function cardsInScope(
  scope: "both" | "groom_only" | "bride_only",
  groomId: string,
  brideId: string,
): Array<{ side: ProposalSide; studentId: string }> {
  const groom = { side: "groom" as const, studentId: groomId };
  const bride = { side: "bride" as const, studentId: brideId };
  if (scope === "groom_only") return [groom];
  if (scope === "bride_only") return [bride];
  return [groom, bride];
}
