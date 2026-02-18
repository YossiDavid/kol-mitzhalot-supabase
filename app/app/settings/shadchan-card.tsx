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

type ApplicationStatus = "pending" | "approved" | "rejected" | null;

interface ShadchanApplication {
  application_status: ApplicationStatus;
  submitted_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  rejected_reason: string | null;
}

export function ShadchanCard() {
  const [application, setApplication] = useState<ShadchanApplication | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const role = user.user_metadata?.role;
      setUserRole(role);

      // אם המשתמש כבר שדכן או אדמין, לא צריך להציג את הכרטיס
      if (role === "shadchan" || role === "admin") {
        setIsLoading(false);
        return;
      }

      // שליפת מידע על הבקשה אם קיימת
      const { data, error } = await supabase
        .from("shadchanim_info")
        .select("application_status, submitted_at, approved_at, rejected_at, rejected_reason")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        // PGRST116 = no rows returned, זה בסדר
        console.error("Error fetching shadchan application:", error);
      }

      setApplication(data || null);
      setIsLoading(false);
    }

    fetchData();
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>הצטרפות כשדכן</CardTitle>
          <CardDescription>טוען...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // אם המשתמש כבר שדכן או אדמין, לא להציג את הכרטיס
  if (userRole === "shadchan" || userRole === "admin") {
    return null;
  }

  const getStatusBadge = () => {
    if (!application?.application_status) {
      return null;
    }

    switch (application.application_status) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-200">
            ממתין לאישור
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-800 border-green-200">
            אושר
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-800 border-red-200">
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
        <CardTitle>הצטרפות כשדכן</CardTitle>
        <CardDescription>
          הגש בקשה להצטרפות כשדכן במערכת
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {application?.application_status && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">סטטוס הבקשה:</span>
              {getStatusBadge()}
            </div>
            {application.submitted_at && (
              <p className="text-sm text-muted-foreground">
                תאריך הגשה: {formatDate(application.submitted_at)}
              </p>
            )}
            {application.approved_at && (
              <p className="text-sm text-muted-foreground">
                תאריך אישור: {formatDate(application.approved_at)}
              </p>
            )}
            {application.rejected_at && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  תאריך דחייה: {formatDate(application.rejected_at)}
                </p>
                {application.rejected_reason && (
                  <p className="text-sm text-destructive">
                    סיבת הדחייה: {application.rejected_reason}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2">
          {!application?.application_status || application.application_status === "rejected" ? (
            <Button asChild>
              <Link href="/app/settings/shadchan">
                {application?.application_status === "rejected"
                  ? "עריכת הבקשה"
                  : "למילוי טופס הצטרפות"}
              </Link>
            </Button>
          ) : application.application_status === "pending" ? (
            <Button asChild variant="outline">
              <Link href="/app/settings/shadchan">עריכת הבקשה</Link>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
