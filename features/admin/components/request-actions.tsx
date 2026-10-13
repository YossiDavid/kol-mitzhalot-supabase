"use client";

import { ApplicationRequestActions } from "./application-request-actions";

interface ShadchanRequestActionsProps {
  requestId: string;
  /** כפתורי אישור/דחייה רק כשהבקשה ממתינה; כפתור ההודעה תמיד */
  isPending: boolean;
}

export function ShadchanRequestActions({
  requestId,
  isPending,
}: ShadchanRequestActionsProps) {
  return (
    <ApplicationRequestActions
      kind="shadchanim"
      requestId={requestId}
      isPending={isPending}
    />
  );
}
