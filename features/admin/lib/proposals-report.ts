import { createClient } from "@/lib/supabase/server";
import { describeSupabaseError } from "@/lib/supabase/describe-error";
import { ISRAEL_TIME_ZONE } from "@/lib/time-zone";
import {
  PROPOSALS_PAGE_SIZE,
  isUuid,
  type ProposalsReportQuery,
} from "@/features/admin/lib/proposals-report-query";

/**
 * דוח ההצעות לניהול: שורה לכל כרטיס שקיבל הצעה (shidduch_events), עם הסטטוס
 * הנוכחי של ההצעה אם היא עדיין קיימת. הקריאה בסשן של המשתמש - מדיניות ה-RLS
 * על shidduch_events מחזירה שורות למנהל בלבד.
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

export async function loadProposalsReport(
  query: ProposalsReportQuery,
): Promise<ProposalsReport> {
  const supabase = await createClient();

  let builder = supabase
    .from("shidduch_events")
    .select(
      "id, created_at, shidduch_id, shadchan_id, shadchan_name, student_id, student_name, other_student_id, other_student_name, side",
      { count: "exact" },
    );

  if (query.shadchan) {
    builder = isUuid(query.shadchan)
      ? builder.eq("shadchan_id", query.shadchan)
      : builder.ilike("shadchan_name", `%${escapeIlike(query.shadchan)}%`);
  }
  if (query.card) {
    builder = isUuid(query.card)
      ? builder.eq("student_id", query.card)
      : builder.ilike("student_name", `%${escapeIlike(query.card)}%`);
  }
  if (query.from) {
    builder = builder.gte("created_at", israelDayStartIso(query.from));
  }
  if (query.to) {
    builder = builder.lt("created_at", israelDayStartIso(query.to, 1));
  }

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

  const events = data ?? [];
  const shidduchIds = [...new Set(events.map((event) => event.shidduch_id))];

  const statusById = new Map<string, string>();
  if (shidduchIds.length > 0) {
    const { data: shidduchim, error: statusError } = await supabase
      .from("shidduchim")
      .select("id, status")
      .in("id", shidduchIds);

    if (statusError) {
      console.error(
        "[admin/proposals] status load",
        describeSupabaseError(statusError),
      );
      throw new Error("טעינת סטטוס ההצעות נכשלה");
    }
    for (const row of shidduchim ?? []) {
      statusById.set(row.id, row.status);
    }
  }

  return {
    total: count ?? 0,
    rows: events.map((event) => ({
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
      currentStatus: statusById.get(event.shidduch_id) ?? null,
    })),
  };
}
