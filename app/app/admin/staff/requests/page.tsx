import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardSection } from "@/components/layout";
import { Box } from "@/components/layout";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { StaffRequestActions } from "@/features/admin/components/staff-request-actions";
import {
  INSTITUTION_TYPE_LABELS,
  type InstitutionType,
} from "@/features/institutions/lib/institution-labels";

type StaffRequestInstitution = {
  name: string;
  city: string | null;
  type: InstitutionType;
};

type StaffRequest = {
  id: string;
  user_id: string;
  institutions: StaffRequestInstitution | null;
  city: string | null;
  position: string | null;
  application_status: "pending" | "approved" | "rejected" | null;
  submitted_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  rejected_reason: string | null;
  user_first_name: string | null;
  user_last_name: string | null;
  user_email: string | null;
};

async function getPendingRequests(): Promise<StaffRequest[]> {
  const supabase = await createClient();
  let adminClient;

  try {
    adminClient = createAdminClient();
  } catch (error) {
    console.error("Admin client error:", error);
    throw error;
  }

  // שליפת כל הבקשות (ממתינות + מאושרות + נדחות), כולל שם/עיר/סוג המוסד המקושר
  const { data, error } = await supabase
    .from("staff_info")
    .select("*, institutions(name, city, type)")
    .order("submitted_at", { ascending: false });

  if (error) {
    console.error("Error fetching pending requests:", error);
    return [];
  }

  if (!data || data.length === 0) {
    return [];
  }

  // שליפת פרטי המשתמשים דרך admin client
  const requests: StaffRequest[] = [];
  for (const request of data) {
    let userFirstName: string | null = null;
    let userLastName: string | null = null;
    let userEmail: string | null = null;

    try {
      const {
        data: { user },
        error: userError,
      } = await adminClient.auth.admin.getUserById(request.user_id);

      if (!userError && user) {
        userFirstName = user.user_metadata?.firstName || null;
        userLastName = user.user_metadata?.lastName || null;
        userEmail = user.email || null;
      }
    } catch (err) {
      console.error(`Error fetching user ${request.user_id}:`, err);
    }

    // PostgREST מחזיר את ה-embed כאובייקט יחיד (יחס many-to-one), אך ה-SDK
    // מקליד אותו כמערך כשאין Database type - מנרמלים לאיבר הראשון בלבד.
    requests.push({
      ...request,
      institutions: Array.isArray(request.institutions)
        ? (request.institutions[0] ?? null)
        : request.institutions,
      user_first_name: userFirstName,
      user_last_name: userLastName,
      user_email: userEmail,
    });
  }

  return requests;
}

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

export default async function StaffRequestsPage() {
  noStore();
  let requests: StaffRequest[] = [];
  let error: Error | null = null;

  try {
    requests = await getPendingRequests();
  } catch (err) {
    error = err instanceof Error ? err : new Error("Unknown error");
    console.error("Error in StaffRequestsPage:", error);
  }

  if (error) {
    return (
      <div className="space-y-10 py-4">
        <DashboardSection
          title="שגיאה"
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
        title="בקשות הצטרפות כאיש צוות"
        titleNumber={requests.length}
        subTitle={`${requests.filter((r) => r.application_status === "pending").length} ממתינות · ${requests.filter((r) => r.application_status === "approved").length} מאושרות · ${requests.filter((r) => r.application_status === "rejected").length} נדחות`}
        button={
          <Button asChild>
            <Link href="/app/admin">חזרה לדף הבית</Link>
          </Button>
        }
      >
        {requests.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            אין בקשות ממתינות לאישור
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {requests.map((request) => (
              <Box key={request.id} className="p-6">
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-subtitle font-semibold">
                          {request.user_first_name || request.user_last_name
                            ? `${request.user_first_name || ""} ${request.user_last_name || ""}`.trim()
                            : `בקשה #${request.id.substring(0, 8)}`}
                        </h3>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-caption font-medium ${
                            request.application_status === "approved"
                              ? "bg-green-100 text-green-800"
                              : request.application_status === "rejected"
                                ? "bg-red-100 text-red-800"
                                : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {request.application_status === "approved"
                            ? "מאושר"
                            : request.application_status === "rejected"
                              ? "נדחה"
                              : "ממתין לאישור"}
                        </span>
                      </div>
                      {request.user_email && (
                        <p className="text-body-sm text-muted-foreground">
                          אימייל: {request.user_email}
                        </p>
                      )}
                      <p className="text-body-sm text-muted-foreground">
                        תאריך הגשה: {formatDate(request.submitted_at)}
                      </p>
                      {request.application_status === "approved" &&
                        request.approved_at && (
                          <p className="text-body-sm text-green-700">
                            אושר ב: {formatDate(request.approved_at)}
                          </p>
                        )}
                      {request.application_status === "rejected" && (
                        <>
                          {request.rejected_at && (
                            <p className="text-body-sm text-red-700">
                              נדחה ב: {formatDate(request.rejected_at)}
                            </p>
                          )}
                          {request.rejected_reason && (
                            <p className="text-body-sm text-red-700">
                              סיבה: {request.rejected_reason}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                    {request.application_status === "pending" && (
                      <StaffRequestActions requestId={request.user_id} />
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <h4 className="mb-1 font-semibold">מוסד לימודים:</h4>
                      <p className="text-body-sm">
                        {request.institutions
                          ? `${request.institutions.name}${request.institutions.city ? ` · ${request.institutions.city}` : ""} · ${INSTITUTION_TYPE_LABELS[request.institutions.type]}`
                          : "לא נבחר"}
                      </p>
                    </div>
                    {request.city && (
                      <div>
                        <h4 className="mb-1 font-semibold">עיר:</h4>
                        <p className="text-body-sm">{request.city}</p>
                      </div>
                    )}
                    {request.position && (
                      <div>
                        <h4 className="mb-1 font-semibold">תפקיד:</h4>
                        <p className="text-body-sm">{request.position}</p>
                      </div>
                    )}
                  </div>
                </div>
              </Box>
            ))}
          </div>
        )}
      </DashboardSection>
    </div>
  );
}
