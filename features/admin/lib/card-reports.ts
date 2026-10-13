import {
  CARD_REPORT_REASONS,
  type CardReportReason,
} from "@/features/students/lib/card-report";
import { createAdminClient } from "@/lib/supabase/admin";
import { describeSupabaseError } from "@/lib/supabase/describe-error";
import { createClient } from "@/lib/supabase/server";

export type CardReportStatus = "open" | "handled";

export type CardReportRow = {
  id: string;
  studentId: string;
  studentName: string | null;
  isStudentPaused: boolean;
  reporterName: string | null;
  reporterEmail: string | null;
  reason: CardReportReason;
  details: string | null;
  status: CardReportStatus;
  createdAt: string;
};

/** ערך ה-search param "status"; ברירת המחדל - דיווחים פתוחים */
export function parseCardReportStatus(
  value: string | undefined,
): CardReportStatus {
  return value === "handled" ? "handled" : "open";
}

function isReason(value: string): value is CardReportReason {
  return (CARD_REPORT_REASONS as readonly string[]).includes(value);
}

type RawReport = {
  id: string;
  student_id: string;
  reporter_id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  students:
    | { first_name: string; last_name: string }
    | { first_name: string; last_name: string }[]
    | null;
};

/** רשימת הדיווחים לדף המנהל (RLS: מנהל בלבד), החדש ראשון */
export async function loadCardReports(
  status: CardReportStatus,
): Promise<CardReportRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("card_reports")
    .select(
      "id, student_id, reporter_id, reason, details, status, created_at, students(first_name, last_name)",
    )
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("[admin/card-reports]", describeSupabaseError(error));
    throw new Error("טעינת הדיווחים נכשלה");
  }
  const reports = (data ?? []) as unknown as RawReport[];
  if (reports.length === 0) return [];

  const admin = createAdminClient();
  const reporterIds = Array.from(new Set(reports.map((r) => r.reporter_id)));
  const studentIds = Array.from(new Set(reports.map((r) => r.student_id)));

  const [identities, pausedRows] = await Promise.all([
    Promise.all(
      reporterIds.map(async (id) => {
        const { data: result } = await admin.auth.admin.getUserById(id);
        const meta = result?.user?.user_metadata ?? {};
        const name = [meta.firstName, meta.lastName].filter(Boolean).join(" ");
        return [
          id,
          { name: name || null, email: result?.user?.email ?? null },
        ] as const;
      }),
    ),
    admin.from("students").select("id, admin_paused_at").in("id", studentIds),
  ]);
  const identityById = new Map(identities);
  const pausedIds = new Set(
    (pausedRows.data ?? [])
      .filter((row) => row.admin_paused_at !== null)
      .map((row) => row.id as string),
  );

  return reports.flatMap((report) => {
    if (!isReason(report.reason)) return [];
    const student = Array.isArray(report.students)
      ? (report.students[0] ?? null)
      : report.students;
    return [
      {
        id: report.id,
        studentId: report.student_id,
        studentName: student
          ? `${student.first_name} ${student.last_name}`
          : null,
        isStudentPaused: pausedIds.has(report.student_id),
        reporterName: identityById.get(report.reporter_id)?.name ?? null,
        reporterEmail: identityById.get(report.reporter_id)?.email ?? null,
        reason: report.reason,
        details: report.details,
        status: report.status === "handled" ? "handled" : "open",
        createdAt: report.created_at,
      } satisfies CardReportRow,
    ];
  });
}
