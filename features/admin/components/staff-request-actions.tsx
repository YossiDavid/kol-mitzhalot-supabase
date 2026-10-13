"use client";

import { ApplicationRequestActions } from "./application-request-actions";

interface StaffRequestActionsProps {
  requestId: string;
  /** כפתורי אישור/דחייה רק כשהבקשה ממתינה; כפתור ההודעה תמיד */
  isPending: boolean;
}

export function StaffRequestActions({
  requestId,
  isPending,
}: StaffRequestActionsProps) {
  return (
    <ApplicationRequestActions
      kind="staff"
      requestId={requestId}
      isPending={isPending}
    />
  );
}
