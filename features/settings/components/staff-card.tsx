"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { hasRole } from "@/lib/user-role";
import {
  INSTITUTION_TYPE_LABELS,
  type InstitutionType,
} from "@/features/institutions/lib/institution-labels";

type ApplicationStatus = "pending" | "approved" | "rejected" | null;

interface StaffApplicationInstitution {
  name: string;
  city: string | null;
  type: InstitutionType;
}

interface StaffApplication {
  application_status: ApplicationStatus;
  submitted_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  rejected_reason: string | null;
  institutions: StaffApplicationInstitution | null;
}

export function StaffCard() {
  const [application, setApplication] = useState<StaffApplication | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<boolean>(false);

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const isStaffOrAdmin = hasRole(user, "staff") || hasRole(user, "admin");
      setUserRole(isStaffOrAdmin);

      // אם המשתמש כבר איש צוות או אדמין, לא צריך להציג את הכרטיס
      if (isStaffOrAdmin) {
        setIsLoading(false);
        return;
      }

      // שליפת מידע על הבקשה אם קיימת, כולל שם/עיר/סוג המוסד המקושר
      const { data, error } = await supabase
        .from("staff_info")
        .select(
          "application_status, submitted_at, approved_at, rejected_at, rejected_reason, institutions(name, city, type)",
        )
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        // PGRST116 = no rows returned, זה בסדר
        console.error("Error fetching staff application:", error);
      }

      // PostgREST מחזיר את ה-embed כאובייקט יחיד (יחס many-to-one), אך ה-SDK
      // מקליד אותו כמערך כשאין Database type - מנרמלים לאיבר הראשון בלבד.
      setApplication(
        data
          ? {
              ...data,
              institutions: Array.isArray(data.institutions)
                ? (data.institutions[0] ?? null)
                : data.institutions,
            }
          : null,
      );
      setIsLoading(false);
    }

    fetchData();
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>הצטרפות כאיש צוות</CardTitle>
          <CardDescription>טוען...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // אם המשתמש כבר איש צוות או אדמין, לא להציג את הכרטיס
  if (userRole) {
    return null;
  }

  const getStatusBadge = () => {
    if (!application?.application_status) {
      return null;
    }

    switch (application.application_status) {
      case "pending":
        return (
          <Badge
            variant="outline"
            className="border-yellow-200 bg-yellow-50 text-yellow-800"
          >
            ממתין לאישור
          </Badge>
        );
      case "approved":
        return (
          <Badge
            variant="outline"
            className="border-green-200 bg-green-50 text-green-800"
          >
            אושר
          </Badge>
        );
      case "rejected":
        return (
          <Badge
            variant="outline"
            className="border-red-200 bg-red-50 text-red-800"
          >
            נדחה
          </Badge>
        );
      default:
        return null;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("he-IL", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>הצטרפות כאיש צוות</CardTitle>
        <CardDescription>הגש בקשה להצטרפות כאיש צוות במערכת</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {application?.application_status && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-body-sm font-medium">סטטוס הבקשה:</span>
              {getStatusBadge()}
            </div>
            <p className="text-body-sm text-muted-foreground">
              מוסד לימודים:{" "}
              {application.institutions
                ? `${application.institutions.name}${application.institutions.city ? ` · ${application.institutions.city}` : ""} · ${INSTITUTION_TYPE_LABELS[application.institutions.type]}`
                : "לא נבחר"}
            </p>
            {application.submitted_at && (
              <p className="text-body-sm text-muted-foreground">
                תאריך הגשה: {formatDate(application.submitted_at)}
              </p>
            )}
            {application.approved_at && (
              <p className="text-body-sm text-muted-foreground">
                תאריך אישור: {formatDate(application.approved_at)}
              </p>
            )}
            {application.rejected_at && (
              <div className="space-y-1">
                <p className="text-body-sm text-muted-foreground">
                  תאריך דחייה: {formatDate(application.rejected_at)}
                </p>
                {application.rejected_reason && (
                  <p className="text-body-sm text-destructive">
                    סיבת הדחייה: {application.rejected_reason}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2">
          {!application?.application_status ||
          application.application_status === "rejected" ? (
            <Button asChild>
              <Link href="/app/settings/staff">
                {application?.application_status === "rejected"
                  ? "עריכת הבקשה"
                  : "למילוי טופס הצטרפות"}
              </Link>
            </Button>
          ) : application.application_status === "pending" ? (
            <Button asChild variant="outline">
              <Link href="/app/settings/staff">עריכת הבקשה</Link>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
