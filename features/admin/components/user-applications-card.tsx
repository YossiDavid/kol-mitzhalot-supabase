import type { Route } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { formatUserDate } from "@/features/admin/lib/user-details";
import {
  applicationAnchorId,
  SHADCHAN_REQUESTS_PATH,
  STAFF_REQUESTS_PATH,
  type UserApplications,
  type UserApplicationSummary,
} from "@/features/admin/lib/user-applications";
import {
  APPLICATION_STATUS_LABELS,
  applicationStatusVariant,
} from "@/lib/application-status";

/** שורה בלי סטטוס = שדכן ותיק שנוסף לפני מנגנון הבקשות */
const NO_STATUS_LABEL = "ללא סטטוס";

type ApplicationRowProps = {
  testId: string;
  label: string;
  application: UserApplicationSummary | null;
  requestHref: string;
  editHref?: string;
};

function ApplicationRow({
  testId,
  label,
  application,
  requestHref,
  editHref,
}: ApplicationRowProps) {
  return (
    <div
      data-testid={testId}
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{label}</span>
        {!application ? (
          <span className="text-muted-foreground">לא הגיש</span>
        ) : (
          <>
            <Badge variant={applicationStatusVariant(application.status)}>
              {application.status
                ? APPLICATION_STATUS_LABELS[application.status]
                : NO_STATUS_LABEL}
            </Badge>
            {application.frozenAt && <Badge variant="danger">מוקפא</Badge>}
            <span className="text-body-sm text-muted-foreground">
              הוגשה: {formatUserDate(application.submittedAt)}
            </span>
          </>
        )}
      </div>
      {application && (
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={requestHref as Route}>לצפייה בבקשה</Link>
          </Button>
          {editHref && (
            <Button asChild variant="outline" size="sm">
              <Link href={editHref as Route}>עריכת פרופיל השדכן</Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/** האם המשתמש הגיש בקשת הצטרפות כשדכן / כאיש צוות, וקישור לבקשה */
export function UserApplicationsCard({
  userId,
  applications,
}: {
  userId: string;
  applications: UserApplications;
}) {
  const anchor = `#${applicationAnchorId(userId)}`;
  return (
    <Card data-testid="user-applications">
      <CardHeader>
        <CardTitle asChild>
          <h2>בקשות הצטרפות</h2>
        </CardTitle>
      </CardHeader>
      <div className="space-y-4">
        <ApplicationRow
          testId="shadchan-application"
          label="בקשת הצטרפות כשדכן:"
          application={applications.shadchan}
          requestHref={`${SHADCHAN_REQUESTS_PATH}${anchor}`}
          editHref={`/app/admin/shadchanim/${userId}/edit`}
        />
        <ApplicationRow
          testId="staff-application"
          label="בקשת הצטרפות כאיש צוות:"
          application={applications.staff}
          requestHref={`${STAFF_REQUESTS_PATH}${anchor}`}
        />
      </div>
    </Card>
  );
}
