"use client";

import type { Route } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  APPLICATION_STATUS_LABELS,
  applicationStatusVariant,
} from "@/lib/application-status";
import { INSTITUTION_TYPE_LABELS } from "@/features/institutions/lib/institution-labels";

import {
  useApplicationStatus,
  type ApplicationInstitution,
  type ApplicationRecord,
  type ApplicationRole,
} from "./use-application-status";

const COPY: Record<
  ApplicationRole,
  { title: string; description: string; href: Route }
> = {
  shadchan: {
    title: "הצטרפות כשדכן",
    description: "הגש בקשה להצטרפות כשדכן במערכת",
    href: "/app/settings/shadchan",
  },
  staff: {
    title: "הצטרפות כאיש צוות",
    description: "הגש בקשה להצטרפות כאיש צוות במערכת",
    href: "/app/settings/staff",
  },
};

const DATE_FORMAT = new Intl.DateTimeFormat("he-IL", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDate(dateString: string | null) {
  return dateString ? DATE_FORMAT.format(new Date(dateString)) : null;
}

function institutionLine(institution: ApplicationInstitution | null) {
  if (!institution) return "לא נבחר";
  const city = institution.city ? ` · ${institution.city}` : "";
  return `${institution.name}${city} · ${INSTITUTION_TYPE_LABELS[institution.type]}`;
}

function StatusDetails({ application }: { application: ApplicationRecord }) {
  const status = application.application_status;
  if (!status) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-body-sm font-medium">סטטוס הבקשה:</span>
        <Badge variant={applicationStatusVariant(status)}>
          {APPLICATION_STATUS_LABELS[status]}
        </Badge>
      </div>
      {application.institutions !== undefined && (
        <p className="text-body-sm text-muted-foreground">
          מוסד לימודים: {institutionLine(application.institutions)}
        </p>
      )}
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
  );
}

function ApplicationAction({
  application,
  href,
}: {
  application: ApplicationRecord | null;
  href: Route;
}) {
  const status = application?.application_status;
  if (!status || status === "rejected") {
    return (
      <Button asChild>
        <Link href={href}>
          {status === "rejected" ? "עריכת הבקשה" : "למילוי טופס הצטרפות"}
        </Link>
      </Button>
    );
  }
  if (status === "pending") {
    return (
      <Button asChild variant="outline">
        <Link href={href}>עריכת הבקשה</Link>
      </Button>
    );
  }
  return null;
}

/**
 * כרטיס בקשת הצטרפות בעמוד ההגדרות, לשדכן או לאיש צוות: סטטוס הבקשה,
 * תאריכים, סיבת דחייה ופעולה לטופס. לא מוצג למי שכבר בתפקיד או מנהל.
 */
export function ApplicationStatusCard({ role }: { role: ApplicationRole }) {
  const state = useApplicationStatus(role);
  const copy = COPY[role];

  if (state.kind === "hasRole") return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.title}</CardTitle>
        <CardDescription>
          {state.kind === "loading" ? (
            <span role="status">
              <span className="sr-only">טוען...</span>
              <Skeleton aria-hidden className="mt-1 h-4 w-56 max-w-full" />
            </span>
          ) : (
            copy.description
          )}
        </CardDescription>
      </CardHeader>
      {state.kind === "ready" && (
        <CardContent className="space-y-4">
          {state.application && (
            <StatusDetails application={state.application} />
          )}
          <div className="flex gap-2">
            <ApplicationAction
              application={state.application}
              href={copy.href}
            />
          </div>
        </CardContent>
      )}
    </Card>
  );
}
