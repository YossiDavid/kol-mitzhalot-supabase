import { Suspense } from "react";
import { unstable_noStore as noStore } from "next/cache";

import { Box, Page, PageHeader } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { AnnouncementForm } from "@/features/announcements/components/announcement-form";
import { AnnouncementToggle } from "@/features/announcements/components/announcement-toggle";
import { AUDIENCE_LABELS } from "@/features/announcements/lib/announcements";
import { loadAnnouncementsReport } from "@/features/announcements/lib/load-announcements-report";
import { formatDateTimeIsrael } from "@/lib/relative-time";

// ההרשאה נאכפת ב-app/app/admin/layout.tsx; הנתונים נשלפים ב-service role

async function AnnouncementsList() {
  noStore();
  const rows = await loadAnnouncementsReport();
  if (rows.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>עדיין לא פורסמו הודעות</EmptyTitle>
          <EmptyDescription>הודעה שתפורסם תופיע כאן, עם רשימת מי שקרא אותה.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <ul className="space-y-4">
      {rows.map((row) => (
        <li key={row.id}>
          <Box className="space-y-3" data-testid="announcement-report-row">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-1">
                <p className="text-body font-bold">{row.title}</p>
                <p className="text-caption text-muted-foreground">
                  {formatDateTimeIsrael(row.createdAt)} · {AUDIENCE_LABELS[row.audience]}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!row.isActive && <Badge variant="outline">מוסתרת</Badge>}
                <AnnouncementToggle id={row.id} isActive={row.isActive} />
              </div>
            </div>
            <p className="text-body-sm whitespace-pre-line">{row.body}</p>
            <details>
              <summary className="cursor-pointer text-body-sm font-medium">
                קראו: {row.readers.length}
              </summary>
              {row.readers.length > 0 && (
                <ul className="mt-2 grid gap-1 text-body-sm sm:grid-cols-2">
                  {row.readers.map((reader) => (
                    <li key={reader.userId}>
                      {reader.name}{" "}
                      <span className="text-muted-foreground">
                        · {formatDateTimeIsrael(reader.readAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </details>
          </Box>
        </li>
      ))}
    </ul>
  );
}

export default function AdminAnnouncementsPage() {
  return (
    <Page>
      <PageHeader
        title="הודעות מערכת"
        description="הודעה שתפורסם כאן תוצג בראש הדף לכל מי שנכנס למערכת, עד שיסמן שקרא. תגובות מגיעות אליך בצ'אט."
      />
      <AnnouncementForm />
      <Suspense fallback={null}>
        <AnnouncementsList />
      </Suspense>
    </Page>
  );
}
