import type { Route } from "next";
import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { Box, Page, PageHeader } from "@/components/layout";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PhotoRequestActions } from "@/features/photo-requests/components/photo-request-actions";
import { Skeleton } from "@/components/ui/skeleton";
import { Suspense } from "react";

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
    cell: (request) => <PhotoRequestActions requestId={request.id} />,
  },
];

async function getPendingRequests(): Promise<PendingPhotoRequest[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("photo_view_requests")
    .select(
      "id, requester_id, student_id, reason, created_at, students(first_name, last_name)",
    )
    .eq("status", "pending")
    .order("created_at", { ascending: false });

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
    // PostgREST מחזיר את ה-embed כאובייקט יחיד (יחס many-to-one), אך ה-SDK
    // מקליד אותו כמערך כשאין Database type - מנרמלים לאיבר הראשון בלבד.
    students: Array.isArray(row.students)
      ? (row.students[0] ?? null)
      : (row.students as PhotoRequestStudent | null),
    requester_name: identities.get(row.requester_id)?.name ?? null,
    requester_email: identities.get(row.requester_id)?.email ?? null,
  }));
}

async function PhotoRequestsContent() {
  noStore();

  let requests: PendingPhotoRequest[] = [];
  let error: Error | null = null;

  try {
    requests = await getPendingRequests();
  } catch (err) {
    error = err instanceof Error ? err : new Error("שגיאה לא ידועה");
  }

  if (error) {
    return (
      <Page>
        <PageHeader
          title="בקשות צפייה בתמונה"
          description="אירעה שגיאה בטעינת הבקשות"
          actions={
            <Button asChild>
              <Link href="/app/admin">חזרה לדף הבית</Link>
            </Button>
          }
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
        actions={
          <Button asChild>
            <Link href="/app/admin">חזרה לדף הבית</Link>
          </Button>
        }
      />
      <Box className="space-y-4">
        <DataTable
          surface={false}
          caption="בקשות צפייה ממתינות"
          columns={PHOTO_REQUEST_COLUMNS}
          rows={requests}
          getRowKey={(request) => request.id}
          emptyState={
            <div className="py-16 text-center">
              <p className="text-subtitle font-semibold text-muted-foreground">
                אין בקשות ממתינות
              </p>
              <p className="mt-2 text-body-sm text-muted-foreground">
                בקשה חדשה תופיע כאן ותישלח אליכם גם כהתראה
              </p>
            </div>
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
        actions={
          <Button asChild>
            <Link href="/app/admin">חזרה לדף הבית</Link>
          </Button>
        }
      />
      <Box>
        <div role="status" aria-label="טוען" className="space-y-4">
          <Skeleton className="h-6 w-full" />
          {Array.from({ length: FALLBACK_ROW_COUNT }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      </Box>
    </Page>
  );
}

export default function PhotoRequestsAdminPage() {
  return (
    <Suspense fallback={<PhotoRequestsFallback />}>
      <PhotoRequestsContent />
    </Suspense>
  );
}
