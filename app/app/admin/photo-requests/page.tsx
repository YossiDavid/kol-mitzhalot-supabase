import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { Box, DashboardSection } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PhotoRequestActions } from "@/features/photo-requests/components/photo-request-actions";

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

export default async function PhotoRequestsAdminPage() {
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
      <div className="space-y-10 py-4">
        <DashboardSection
          title="בקשות צפייה בתמונה"
          subTitle="אירעה שגיאה בטעינת הבקשות"
          button={
            <Button asChild>
              <Link href="/app/admin">חזרה לדף הבית</Link>
            </Button>
          }
        >
          <div className="mt-6 rounded-lg border border-destructive bg-destructive/10 p-6">
            <h3 className="mb-2 text-subtitle font-semibold text-destructive">
              שגיאה בטעינת הבקשות
            </h3>
            <p className="text-body-sm">{error.message}</p>
          </div>
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="space-y-10 py-4">
      <DashboardSection
        title="בקשות צפייה בתמונה"
        titleNumber={requests.length}
        subTitle="שדכנים שביקשו הרשאה לצפות בתמונת מיועדת. אישור חושף את התמונה למבקש בכרטיס אחד בלבד."
        button={
          <Button asChild>
            <Link href="/app/admin">חזרה לדף הבית</Link>
          </Button>
        }
      >
        <Box className="mt-6 space-y-4">
          {requests.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-subtitle font-semibold text-muted-foreground">
                אין בקשות ממתינות
              </p>
              <p className="mt-2 text-body-sm text-muted-foreground">
                בקשה חדשה תופיע כאן ותישלח אליכם גם כהתראה
              </p>
            </div>
          ) : (
            <table className="w-full text-body-sm">
              <thead>
                <tr className="border-b text-right text-muted-foreground">
                  <th className="py-2 pe-3 font-medium">מבקש</th>
                  <th className="py-2 pe-3 font-medium">מיועדת</th>
                  <th className="py-2 pe-3 font-medium">נימוק</th>
                  <th className="py-2 pe-3 font-medium">תאריך הבקשה</th>
                  <th className="py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr
                    key={request.id}
                    className="border-b last:border-0 hover:bg-muted/40"
                  >
                    <td className="py-3 pe-3">
                      <span className="font-medium">
                        {request.requester_name ?? "משתמש לא מזוהה"}
                      </span>
                      {request.requester_email && (
                        <span className="block text-caption text-muted-foreground">
                          {request.requester_email}
                        </span>
                      )}
                    </td>
                    <td className="py-3 pe-3">
                      {request.students ? (
                        <Link
                          href={`/app/students/${request.student_id}`}
                          className="font-medium underline-offset-2 hover:underline"
                        >
                          {request.students.first_name}{" "}
                          {request.students.last_name}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">
                          כרטיס לא נמצא
                        </span>
                      )}
                    </td>
                    <td className="py-3 pe-3 text-muted-foreground">
                      {request.reason ?? "-"}
                    </td>
                    <td className="py-3 pe-3 text-muted-foreground">
                      {formatDate(request.created_at)}
                    </td>
                    <td className="py-3">
                      <PhotoRequestActions requestId={request.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Box>
      </DashboardSection>
    </div>
  );
}
