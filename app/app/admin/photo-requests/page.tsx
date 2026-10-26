import type { Route } from "next";
import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { Box, Page, PageHeader } from "@/components/layout";
import {
  DataTable,
  DataTableSkeleton,
  type DataTableColumn,
} from "@/components/data-table";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PhotoRequestActions } from "@/features/photo-requests/components/photo-request-actions";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  PHOTO_REQUEST_STATUS_LABELS,
  type PhotoRequestStatus,
} from "@/features/photo-requests/lib/photo-request-status";

const STATUS_TABS: readonly PhotoRequestStatus[] = [
  "pending",
  "approved",
  "rejected",
];

/** כמה בקשות שהוכרעו מוצגות (החדשות קודם) */
const DECIDED_LIMIT = 200;

type PhotoRequestsSearchParams = Promise<{ status?: string | string[] }>;

function parseStatus(value: string | string[] | undefined): PhotoRequestStatus {
  const raw = Array.isArray(value) ? value[0] : value;
  return STATUS_TABS.find((status) => status === raw) ?? "pending";
}

// מספר שורות השלד בזמן הטעינה - מקרב את גובה הטבלה האמיתית ומונע קפיצת פריסה.
const FALLBACK_ROW_COUNT = 4;

// ההרשאה עצמה נאכפת בשתי שכבות שאינן תלויות בדף הזה: app/app/admin/layout.tsx
// מפנה החוצה כל מי שאינו מנהל, ומדיניות ה-RLS על photo_view_requests מחזירה
// למשתמש רגיל את השורות שלו בלבד ומאפשרת UPDATE למנהל בלבד.

type PhotoRequestStudent = {
  first_name: string;
  last_name: string;
};

type PendingPhotoRequest = {
  id: string;
  requester_id: string;
  student_id: string;
  reason: string | null;
  created_at: string;
  status: PhotoRequestStatus;
  decided_at: string | null;
  students: PhotoRequestStudent | null;
  requester_name: string | null;
  requester_email: string | null;
};

function formatDate(dateString: string | null): string {
  if (!dateString) return "לא זמין";
  return new Intl.DateTimeFormat("he-IL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateString));
}

const PHOTO_REQUEST_COLUMNS: DataTableColumn<PendingPhotoRequest>[] = [
  {
    key: "requester",
    header: "מבקש",
    size: "grow",
    mobile: "title",
    cell: (request) => (
      <>
        <span className="font-medium">
          {request.requester_name ?? "משתמש לא מזוהה"}
        </span>
        {request.requester_email && (
          <span className="block text-caption font-normal wrap-anywhere text-muted-foreground">
            {request.requester_email}
          </span>
        )}
      </>
    ),
  },
  {
    key: "student",
    header: "מיועדת",
    cell: (request) =>
      request.students ? (
        <Link
          href={`/app/students/${request.student_id}` as Route}
          className="font-medium underline-offset-2 hover:underline"
        >
          {request.students.first_name} {request.students.last_name}
        </Link>
      ) : (
        <span className="text-muted-foreground">כרטיס לא נמצא</span>
      ),
  },
  {
    key: "reason",
    header: "נימוק",
    size: "grow",
    className: "text-muted-foreground",
    cell: (request) => request.reason ?? "-",
  },
  {
    key: "created",
    header: "תאריך הבקשה",
    className: "text-muted-foreground",
    cell: (request) => formatDate(request.created_at),
  },
  {
    key: "actions",
    header: <span className="sr-only">פעולות</span>,
    size: "min",
    mobile: "actions",
    cell: (request) =>
      request.status === "pending" ? (
        <PhotoRequestActions requestId={request.id} />
      ) : (
        <span className="flex flex-col items-start gap-1">
          <Badge variant={request.status === "approved" ? "default" : "outline"}>
            {PHOTO_REQUEST_STATUS_LABELS[request.status]}
          </Badge>
          <span className="text-caption text-muted-foreground">
            {formatDate(request.decided_at)}
          </span>
        </span>
      ),
  },
];

async function getRequests(
  status: PhotoRequestStatus,
): Promise<PendingPhotoRequest[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("photo_view_requests")
    .select(
      "id, requester_id, student_id, reason, created_at, status, decided_at, students(first_name, last_name)",
    )
    .eq("status", status)
    .order(status === "pending" ? "created_at" : "decided_at", {
      ascending: false,
      nullsFirst: false,
    })
    .limit(status === "pending" ? 1000 : DECIDED_LIMIT);

  if (error) {
    console.error("[admin/photo-requests]", error);
    throw new Error(error.message);
  }
  if (!data || data.length === 0) return [];

  // שמות המבקשים יושבים ב-auth.users ולכן דורשים את לקוח ה-admin, בדיוק
  // כמו במסך בקשות אנשי הצוות. הפענוח נעשה פעם אחת לכל מבקש ייחודי, כי
  // אותו שדכן יכול להופיע בכמה בקשות ממתינות.
  const admin = createAdminClient();
  const requesterIds = Array.from(new Set(data.map((row) => row.requester_id)));
  const identities = new Map<
    string,
    { name: string | null; email: string | null }
  >();

  for (const requesterId of requesterIds) {
    try {
      const { data: result, error: userError } =
        await admin.auth.admin.getUserById(requesterId);
      if (userError || !result?.user) {
        console.error("[admin/photo-requests] getUserById", userError);
        continue;
      }
      const { firstName, lastName } = result.user.user_metadata ?? {};
      const name = [firstName, lastName].filter(Boolean).join(" ").trim();
      identities.set(requesterId, {
        name: name || null,
        email: result.user.email ?? null,
      });
    } catch (err) {
      console.error("[admin/photo-requests] getUserById", err);
    }
  }

  return data.map((row) => ({
    ...row,
    status: row.status as PhotoRequestStatus,
    // PostgREST מחזיר את ה-embed כאובייקט יחיד (יחס many-to-one), אך ה-SDK
    // מקליד אותו כמערך כשאין Database type - מנרמלים לאיבר הראשון בלבד.
    students: Array.isArray(row.students)
      ? (row.students[0] ?? null)
      : (row.students as PhotoRequestStudent | null),
    requester_name: identities.get(row.requester_id)?.name ?? null,
    requester_email: identities.get(row.requester_id)?.email ?? null,
  }));
}

async function PhotoRequestsContent({
  searchParams,
}: {
  searchParams: PhotoRequestsSearchParams;
}) {
  noStore();
  const status = parseStatus((await searchParams).status);

  let requests: PendingPhotoRequest[] = [];
  let error: Error | null = null;

  try {
    requests = await getRequests(status);
  } catch (err) {
    error = err instanceof Error ? err : new Error("שגיאה לא ידועה");
  }

  if (error) {
    return (
      <Page>
        <PageHeader
          title="בקשות צפייה בתמונה"
          description="אירעה שגיאה בטעינת הבקשות"
        />
        <div className="rounded-lg border border-destructive bg-destructive/10 p-6">
          <h3 className="mb-2 text-subtitle font-semibold text-destructive">
            שגיאה בטעינת הבקשות
          </h3>
          <p className="text-body-sm">{error.message}</p>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title="בקשות צפייה בתמונה"
        count={requests.length}
        description="שדכנים שביקשו הרשאה לצפות בתמונת מיועדת. אישור חושף את התמונה למבקש בכרטיס אחד בלבד."
      />
      <nav aria-label="סטטוס הבקשות" className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <Button
            key={tab}
            asChild
            size="sm"
            variant={tab === status ? "default" : "outline"}
          >
            <Link
              href={
                (tab === "pending"
                  ? "/app/admin/photo-requests"
                  : `/app/admin/photo-requests?status=${tab}`) as Route
              }
              aria-current={tab === status ? "page" : undefined}
              data-testid={`photo-requests-tab-${tab}`}
            >
              {tab === "pending" ? "ממתינות" : tab === "approved" ? "אושרו" : "נדחו"}
            </Link>
          </Button>
        ))}
      </nav>
      <Box className="space-y-4">
        <DataTable
          surface={false}
          caption={`בקשות צפייה - ${PHOTO_REQUEST_STATUS_LABELS[status]}`}
          columns={PHOTO_REQUEST_COLUMNS}
          rows={requests}
          getRowKey={(request) => request.id}
          emptyState={
            <Empty size="compact" surface={false}>
              <EmptyHeader>
                <EmptyTitle>
                  {status === "pending"
                    ? "אין בקשות ממתינות"
                    : status === "approved"
                      ? "אין בקשות שאושרו"
                      : "אין בקשות שנדחו"}
                </EmptyTitle>
                <EmptyDescription>
                  בקשה חדשה תופיע כאן ותישלח אליכם גם כהתראה
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          }
        />
      </Box>
    </Page>
  );
}

function PhotoRequestsFallback() {
  return (
    <Page>
      <PageHeader
        title="בקשות צפייה בתמונה"
        description="שדכנים שביקשו הרשאה לצפות בתמונת מיועדת. אישור חושף את התמונה למבקש בכרטיס אחד בלבד."
      />
      <Box>
        <DataTableSkeleton
          surface={false}
          rows={FALLBACK_ROW_COUNT}
          columns={4}
        />
      </Box>
    </Page>
  );
}

export default function PhotoRequestsAdminPage({
  searchParams,
}: {
  searchParams: PhotoRequestsSearchParams;
}) {
  return (
    <Suspense fallback={<PhotoRequestsFallback />}>
      <PhotoRequestsContent searchParams={searchParams} />
    </Suspense>
  );
}
