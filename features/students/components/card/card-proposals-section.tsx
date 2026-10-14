import type { Route } from "next";
import Link from "next/link";

import { proposalsReportHref } from "@/features/admin/lib/proposals-report-query";
import {
  SHIDDUCH_STATUS_LABELS,
  isShidduchStatus,
} from "@/features/shidduchim/lib/status";
import type { CardProposals } from "@/features/students/lib/card-proposals";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("he-IL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function statusLabel(status: string | null): string {
  if (!status) return "ההצעה נמחקה";
  return isShidduchStatus(status) ? SHIDDUCH_STATUS_LABELS[status] : status;
}

/**
 * כמה הצעות הוצעו לכרטיס. בעל הכרטיס רואה את המספר; שדכן - גם את ההצעות שהוא
 * עצמו הציע; מנהל - את כולן, עם שם השדכן וקישור לדוח ההצעות.
 */
export function CardProposalsSection({
  studentId,
  proposals,
}: {
  studentId: string;
  proposals: CardProposals;
}) {
  const { total, rows, scope } = proposals;
  return (
    <section
      className="space-y-2 rounded-lg border border-border bg-card p-4"
      data-testid="card-proposals"
      data-scope={scope}
    >
      <h2 className="text-body-sm font-bold">
        הצעות שהוצעו לכרטיס:{" "}
        <span data-testid="card-proposals-total">{total}</span>
      </h2>
      {scope === "shadchan" && rows && rows.length > 0 && (
        <p className="text-caption text-muted-foreground">ההצעות שלך:</p>
      )}
      {rows && rows.length > 0 && (
        <ul className="space-y-1" data-testid="card-proposals-list">
          {rows.map((row) => (
            <li
              key={`${row.shidduchId}-${row.sentAt}`}
              className="flex flex-wrap gap-x-3 text-caption"
            >
              <span>{formatDate(row.sentAt)}</span>
              <span>מול {row.otherName ?? "כרטיס"}</span>
              {row.shadchanName && <span>שדכן: {row.shadchanName}</span>}
              <span className="text-muted-foreground">
                {statusLabel(row.status)}
              </span>
              {row.status && (
                <Link
                  href={`/app/shidduchim/${row.shidduchId}` as Route}
                  className="text-primary hover:underline"
                >
                  להצעה
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
      {scope === "admin" && (
        <Link
          href={proposalsReportHref({ card: studentId }) as Route}
          className="text-caption text-primary hover:underline"
        >
          לכל ההצעות בדוח ההצעות
        </Link>
      )}
    </section>
  );
}
