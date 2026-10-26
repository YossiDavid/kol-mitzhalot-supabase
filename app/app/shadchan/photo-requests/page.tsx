import type { Route } from "next";
import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { Suspense } from "react";

import { Box, Page, PageHeader } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  PHOTO_REQUEST_STATUS_LABELS,
  type PhotoRequestStatus,
} from "@/features/photo-requests/lib/photo-request-status";
import { formatDateTimeIsrael } from "@/lib/relative-time";
import { createClient } from "@/lib/supabase/server";

type MyPhotoRequest = {
  id: string;
  studentId: string;
  studentName: string | null;
  status: PhotoRequestStatus;
  createdAt: string;
  decidedAt: string | null;
};

const STATUS_ORDER: Record<PhotoRequestStatus, number> = {
  approved: 0,
  pending: 1,
  rejected: 2,
};

/** בקשות הצפייה בתמונה של המשתמש המחובר (RLS: רק שלו) */
async function loadMyPhotoRequests(): Promise<MyPhotoRequest[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("photo_view_requests")
    .select("id, student_id, status, created_at, decided_at, students(first_name, last_name)")
    .eq("requester_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`[shadchan/photo-requests] ${error.message}`);
  return (data ?? [])
    .map((row) => {
      const student = Array.isArray(row.students) ? row.students[0] : row.students;
      return {
        id: row.id,
        studentId: row.student_id,
        studentName: student ? `${student.first_name} ${student.last_name}` : null,
        status: row.status as PhotoRequestStatus,
        createdAt: row.created_at,
        decidedAt: row.decided_at,
      };
    })
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
}

async function MyPhotoRequestsList() {
  noStore();
  const requests = await loadMyPhotoRequests();
  if (requests.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>עדיין לא ביקשת לצפות בתמונה</EmptyTitle>
          <EmptyDescription>
            בכרטיס עם תמונה נעולה לוחצים &quot;בקשה לצפייה בתמונה&quot;. אחרי
            אישור ההנהלה הבקשה תופיע כאן, עם קישור לכרטיס.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <Box className="p-0">
      <ul className="divide-y divide-border" data-testid="my-photo-requests">
        {requests.map((request) => (
          <li
            key={request.id}
            className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
          >
            <div className="space-y-0.5">
              {request.studentName ? (
                <Link
                  href={`/app/students/${request.studentId}` as Route}
                  className="font-medium underline-offset-2 hover:underline"
                >
                  {request.studentName}
                </Link>
              ) : (
                <span className="text-muted-foreground">הכרטיס אינו זמין</span>
              )}
              <p className="text-caption text-muted-foreground">
                בקשה מ-{formatDateTimeIsrael(request.createdAt)}
                {request.decidedAt &&
                  ` · הוכרעה ${formatDateTimeIsrael(request.decidedAt)}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={request.status === "approved" ? "default" : "outline"}>
                {PHOTO_REQUEST_STATUS_LABELS[request.status]}
              </Badge>
              {request.status === "approved" && request.studentName && (
                <Link
                  href={`/app/students/${request.studentId}` as Route}
                  className="text-body-sm text-primary underline-offset-2 hover:underline"
                >
                  לצפייה בתמונה
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Box>
  );
}

export default function MyPhotoRequestsPage() {
  return (
    <Page>
      <PageHeader
        title="בקשות התמונה שלי"
        description="תמונה שאושרה לך מוצגת בכרטיס המיועדת. כאן כל הבקשות שלך ומצבן."
      />
      <Suspense fallback={null}>
        <MyPhotoRequestsList />
      </Suspense>
    </Page>
  );
}
