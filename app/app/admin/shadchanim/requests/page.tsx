import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Box, Page, PageHeader } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { APPLICATION_STATUS_BADGE_VARIANT } from "@/lib/application-status";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { ShadchanRequestActions } from "@/features/admin/components/request-actions";
import { Skeleton } from "@/components/ui/skeleton";
import { Suspense } from "react";

// מספר כרטיסי השלד בזמן הטעינה - מקרב את גובה הרשימה האמיתית.
const FALLBACK_CARD_COUNT = 3;

type ShadchanRequest = {
  id: string;
  user_id: string;
  bio: string | null;
  experience_years: number | null;
  specializations: string[] | null;
  contact_phone: string | null;
  contact_email: string | null;
  website_url: string | null;
  location: string | null;
  languages: string[] | null;
  certifications: string[] | null;
  application_status: "pending" | "approved" | "rejected" | null;
  submitted_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  rejected_reason: string | null;
  user_first_name: string | null;
  user_last_name: string | null;
  user_email: string | null;
};

async function getPendingRequests(): Promise<ShadchanRequest[]> {
  const supabase = await createClient();
  let adminClient;
  
  try {
    adminClient = createAdminClient();
  } catch (error) {
    console.error("Admin client error:", error);
    throw error;
  }

  // שליפת כל הבקשות (ממתינות + מאושרות + נדחות)
  const { data, error } = await supabase
    .from("shadchanim_info")
    .select("*")
    .order("submitted_at", { ascending: false });

  if (error) {
    console.error("Error fetching pending requests:", error);
    return [];
  }

  if (!data || data.length === 0) {
    return [];
  }

  // שליפת פרטי המשתמשים דרך admin client
  const requests: ShadchanRequest[] = [];
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

    requests.push({
      ...request,
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

async function ShadchanRequestsContent() {
  noStore();
  let requests: ShadchanRequest[] = [];
  let error: Error | null = null;

  try {
    requests = await getPendingRequests();
  } catch (err) {
    error = err instanceof Error ? err : new Error("Unknown error");
    console.error("Error in ShadchanRequestsPage:", error);
  }

  if (error) {
    return (
      <Page>
        <PageHeader
          title="שגיאה"
          description="אירעה שגיאה בטעינת הבקשות"
          actions={
            <Button asChild>
              <Link href="/app/admin">חזרה לדף הבית</Link>
            </Button>
          }
        />
          <div className="border-destructive bg-destructive/10 rounded-lg border p-6">
            <h3 className="text-destructive mb-2 text-subtitle font-semibold">
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
        title="בקשות הצטרפות כשדכן"
        count={requests.length}
        description={`${requests.filter(r => r.application_status === "pending").length} ממתינות · ${requests.filter(r => r.application_status === "approved").length} מאושרות · ${requests.filter(r => r.application_status === "rejected").length} נדחות`}
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/app/admin/shadchanim">כל השדכנים</Link>
            </Button>
            <Button asChild>
              <Link href="/app/admin">חזרה לדף הבית</Link>
            </Button>
          </div>
        }
      />
        {requests.length === 0 ? (
          <div className="text-muted-foreground py-10 text-center">
            אין בקשות ממתינות לאישור
          </div>
        ) : (
          <div className="space-y-6">
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
                        <Badge
                          variant={
                            APPLICATION_STATUS_BADGE_VARIANT[
                              request.application_status ?? "pending"
                            ]
                          }
                        >
                          {request.application_status === "approved"
                            ? "מאושר"
                            : request.application_status === "rejected"
                            ? "נדחה"
                            : "ממתין לאישור"}
                        </Badge>
                      </div>
                      {request.user_email && (
                        <p className="text-body-sm text-muted-foreground">
                          אימייל: {request.user_email}
                        </p>
                      )}
                      <p className="text-body-sm text-muted-foreground">
                        תאריך הגשה: {formatDate(request.submitted_at)}
                      </p>
                      {request.application_status === "approved" && request.approved_at && (
                        <p className="text-body-sm text-success-muted-foreground">
                          אושר ב: {formatDate(request.approved_at)}
                        </p>
                      )}
                      {request.application_status === "rejected" && (
                        <>
                          {request.rejected_at && (
                            <p className="text-body-sm text-destructive">
                              נדחה ב: {formatDate(request.rejected_at)}
                            </p>
                          )}
                          {request.rejected_reason && (
                            <p className="text-body-sm text-destructive">
                              סיבה: {request.rejected_reason}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                    {request.application_status === "pending" && (
                      <ShadchanRequestActions requestId={request.user_id} />
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {request.bio && (
                      <div>
                        <h4 className="font-semibold mb-1">ביוגרפיה:</h4>
                        <p className="text-body-sm">{request.bio}</p>
                      </div>
                    )}
                    {request.experience_years !== null && (
                      <div>
                        <h4 className="font-semibold mb-1">שנות ניסיון:</h4>
                        <p className="text-body-sm">{request.experience_years}</p>
                      </div>
                    )}
                    {request.specializations && request.specializations.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-1">התמחויות:</h4>
                        <p className="text-body-sm">
                          {request.specializations.join(", ")}
                        </p>
                      </div>
                    )}
                    {request.contact_phone && (
                      <div>
                        <h4 className="font-semibold mb-1">טלפון:</h4>
                        <p className="text-body-sm">{request.contact_phone}</p>
                      </div>
                    )}
                    {request.contact_email && (
                      <div>
                        <h4 className="font-semibold mb-1">אימייל:</h4>
                        <p className="text-body-sm">{request.contact_email}</p>
                      </div>
                    )}
                    {request.location && (
                      <div>
                        <h4 className="font-semibold mb-1">מיקום:</h4>
                        <p className="text-body-sm">{request.location}</p>
                      </div>
                    )}
                    {request.languages && request.languages.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-1">שפות:</h4>
                        <p className="text-body-sm">{request.languages.join(", ")}</p>
                      </div>
                    )}
                    {request.certifications && request.certifications.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-1">תעודות:</h4>
                        <p className="text-body-sm">
                          {request.certifications.join(", ")}
                        </p>
                      </div>
                    )}
                    {request.website_url && (
                      <div>
                        <h4 className="font-semibold mb-1">אתר:</h4>
                        <p className="text-body-sm">
                          <a
                            href={request.website_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline"
                          >
                            {request.website_url}
                          </a>
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </Box>
            ))}
          </div>
        )}
    </Page>
  );
}

function ShadchanRequestsFallback() {
  return (
    <Page>
      <PageHeader
        title="בקשות הצטרפות כשדכן"
        description="טוען בקשות…"
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/app/admin/shadchanim">כל השדכנים</Link>
            </Button>
            <Button asChild>
              <Link href="/app/admin">חזרה לדף הבית</Link>
            </Button>
          </div>
        }
      />
        <div role="status" aria-label="טוען" className="space-y-6">
          {Array.from({ length: FALLBACK_CARD_COUNT }).map((_, index) => (
            <Box key={index} className="p-6">
              <div className="space-y-4">
                <Skeleton className="h-6 w-56" />
                <Skeleton className="h-4 w-72" />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              </div>
            </Box>
          ))}
        </div>
    </Page>
  );
}

export default function ShadchanRequestsPage() {
  return (
    <Suspense fallback={<ShadchanRequestsFallback />}>
      <ShadchanRequestsContent />
    </Suspense>
  );
}
