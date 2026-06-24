import { Box } from "@/components/layout";
import { Spinner } from "@/components/ui/spinner";
import { ShadchanimPagination, ShadchanimPerPageSelect } from "@/features/admin/components/shadchanim-pagination";
import type { AdminShadchanimQuery } from "@/features/admin/lib/shadchanim";
import { getShadchanimList } from "@/features/admin/lib/shadchanim";
import { Suspense } from "react";

function formatDate(dateString: string | null): string {
  if (!dateString) return "לא זמין";
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("he-IL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function statusClass(status: string): string {
  if (status === "ממתין לאישור") return "text-amber-700";
  if (status === "נדחה") return "text-destructive";
  return "";
}

export function ShadchanimListFallback() {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm">
      <Spinner />
      טוען רשימת שדכנים…
    </div>
  );
}

export async function ShadchanimList({ query }: { query: AdminShadchanimQuery }) {
  const { rows: stats, total, page, perPage, lastPage } =
    await getShadchanimList(query);

  if (total === 0) {
    return (
      <div className="text-muted-foreground py-10 text-center">
        לא נמצאו שדכנים במערכת
      </div>
    );
  }

  return (
    <>
      <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 pt-6 text-sm">
        <span>
          מציג {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} מתוך{" "}
          {total}
        </span>
        <div className="flex flex-wrap items-center gap-4">
          <span>
            עמוד {page} מתוך {lastPage}
          </span>
          <Suspense
            fallback={
              <span className="text-muted-foreground text-sm">לעמוד…</span>
            }
          >
            <ShadchanimPerPageSelect />
          </Suspense>
        </div>
      </div>
      <div className="grid grid-cols-[1.5fr_2fr_2fr_2fr_1.5fr_1fr_1fr_1fr_2fr_2fr_2fr] gap-4 pt-2">
        <div
          data-slot="table-header"
          className="col-span-full grid grid-cols-subgrid font-semibold"
        >
          <div>סטטוס</div>
          <div>שם פרטי</div>
          <div>שם משפחה</div>
          <div>אימייל</div>
          <div>תאריך הצטרפות</div>
          <div>שידוכים נוצרו</div>
          <div>שידוכים נסגרו</div>
          <div>הצעה אחרונה</div>
          <div>שידוך אחרון נסגר</div>
          <div>התחברות אחרונה</div>
        </div>
        {stats.map((shadchan) => (
          <Box
            key={shadchan.id}
            className="col-span-full grid grid-cols-subgrid items-center"
          >
            <div
              className={`text-sm font-medium ${statusClass(shadchan.applicationStatusLabel)}`}
            >
              {shadchan.applicationStatusLabel}
            </div>
            <div>{shadchan.firstName || "לא זמין"}</div>
            <div>{shadchan.lastName || "לא זמין"}</div>
            <div className="text-sm">{shadchan.email || "לא זמין"}</div>
            <div className="text-sm">{formatDate(shadchan.createdAt)}</div>
            <div className="text-center">{shadchan.totalShidduchim}</div>
            <div className="text-center">{shadchan.completedShidduchim}</div>
            <div className="text-sm">
              {formatDate(shadchan.lastShidduchCreatedAt)}
            </div>
            <div className="text-sm">
              {formatDate(shadchan.lastShidduchCompletedAt)}
            </div>
            <div className="text-sm">{formatDate(shadchan.lastSignInAt)}</div>
          </Box>
        ))}
      </div>

      <ShadchanimPagination page={page} lastPage={lastPage} perPage={perPage} />
    </>
  );
}
