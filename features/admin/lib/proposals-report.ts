import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { describeSupabaseError } from "@/lib/supabase/describe-error";
import { ISRAEL_TIME_ZONE } from "@/lib/time-zone";
import {
  DELETED_STATUS_FILTER,
  PROPOSALS_PAGE_SIZE,
  isUuid,
  type ProposalsReportQuery,
} from "@/features/admin/lib/proposals-report-query";

/**
 * "כל ההצעות" לניהול: שורה לכל כרטיס שקיבל הצעה (shidduch_events), עם הסטטוס
 * הנוכחי והיקף השליחה של ההצעה אם היא עדיין קיימת - מה-view
 * shidduch_events_report. הקריאה בסשן של המשתמש - מדיניות ה-RLS על
 * shidduch_events (security_invoker) מחזירה שורות למנהל בלבד.
 */

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE;

export type ProposalEventRow = {
  id: string;
  createdAt: string;
  shidduchId: string;
  shadchanId: string;
  shadchanName: string | null;
  studentId: string;
  studentName: string | null;
  otherStudentId: string;
  otherStudentName: string | null;
  side: "groom" | "bride";
  /** null = ההצעה נמחקה */
  currentStatus: string | null;
  /** למי ההצעה נשלחה כיום (both/groom_only/bride_only); null = נמחקה */
  recipientScope: string | null;
};

export type ProposalsReport = {
  rows: ProposalEventRow[];
  total: number;
};

/** היסט אזור הזמן של ישראל (בדקות) ברגע נתון, כולל שעון קיץ */
function israelOffsetMinutes(at: Date): number {
  const zoneName =
    new Intl.DateTimeFormat("en-US", {
      timeZone: ISRAEL_TIME_ZONE,
      timeZoneName: "longOffset",
    })
      .formatToParts(at)
      .find((part) => part.type === "timeZoneName")?.value ?? "GMT+00:00";
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(zoneName);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

/** תחילת היום (או תחילת היום שאחריו) לפי שעון ישראל, כ-ISO */
export function israelDayStartIso(date: string, dayOffset = 0): string {
  const utcMidnight = Date.parse(`${date}T00:00:00Z`) + dayOffset * MS_PER_DAY;
  const offset = israelOffsetMinutes(new Date(utcMidnight));
  return new Date(utcMidnight - offset * MS_PER_MINUTE).toISOString();
}

/** מחרוזת לחיפוש ilike: תווים מיוחדים נחשבים כטקסט רגיל */
function escapeIlike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** שורת shidduch_events_report - מאומתת כי היא מידע חיצוני */
const reportRowSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  shidduch_id: z.string(),
  shadchan_id: z.string(),
  shadchan_name: z.string().nullable(),
  student_id: z.string(),
  student_name: z.string().nullable(),
  other_student_id: z.string(),
  other_student_name: z.string().nullable(),
  side: z.enum(["groom", "bride"]),
  current_status: z.string().nullable(),
  recipient_scope: z.string().nullable(),
});

type ReportBuilder = ReturnType<
  ReturnType<Awaited<ReturnType<typeof createClient>>["from"]>["select"]
>;

function applyFilters(
  builder: ReportBuilder,
  query: ProposalsReportQuery,
): ReportBuilder {
  let next = builder;
  if (query.shadchan) {
    next = isUuid(query.shadchan)
      ? next.eq("shadchan_id", query.shadchan)
      : next.ilike("shadchan_name", `%${escapeIlike(query.shadchan)}%`);
  }
  if (query.card) {
    next = isUuid(query.card)
      ? next.eq("student_id", query.card)
      : next.ilike("student_name", `%${escapeIlike(query.card)}%`);
  }
  if (query.from) {
    next = next.gte("created_at", israelDayStartIso(query.from));
  }
  if (query.to) {
    next = next.lt("created_at", israelDayStartIso(query.to, 1));
  }
  if (query.status === DELETED_STATUS_FILTER) {
    next = next.is("current_status", null);
  } else if (query.status) {
    next = next.eq("current_status", query.status);
  }
  return next;
}

export async function loadProposalsReport(
  query: ProposalsReportQuery,
): Promise<ProposalsReport> {
  const supabase = await createClient();

  const builder = applyFilters(
    supabase
      .from("shidduch_events_report")
      .select(
        "id, created_at, shidduch_id, shadchan_id, shadchan_name, student_id, student_name, other_student_id, other_student_name, side, current_status, recipient_scope",
        { count: "exact" },
      ),
    query,
  );

  const rangeStart = (query.page - 1) * PROPOSALS_PAGE_SIZE;
  const { data, count, error } = await builder
    .order("created_at", { ascending: false })
    .range(rangeStart, rangeStart + PROPOSALS_PAGE_SIZE - 1);

  if (error) {
    console.error(
      "[admin/proposals] events load",
      describeSupabaseError(error),
    );
    throw new Error("טעינת יומן ההצעות נכשלה");
  }

  const parsed = z.array(reportRowSchema).safeParse(data ?? []);
  if (!parsed.success) {
    console.error("[admin/proposals] unexpected shape", parsed.error.issues);
    throw new Error("טעינת יומן ההצעות נכשלה");
  }

  return {
    total: count ?? 0,
    rows: parsed.data.map((event) => ({
      id: event.id,
      createdAt: event.created_at,
      shidduchId: event.shidduch_id,
      shadchanId: event.shadchan_id,
      shadchanName: event.shadchan_name,
      studentId: event.student_id,
      studentName: event.student_name,
      otherStudentId: event.other_student_id,
      otherStudentName: event.other_student_name,
      side: event.side,
      currentStatus: event.current_status,
      recipientScope: event.recipient_scope,
    })),
  };
}
