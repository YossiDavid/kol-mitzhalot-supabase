"use client";

import { Suspense } from "react";

import { StaffApplicationForm } from "@/features/settings/components/staff-application-form";
import { StaffPageSkeleton } from "@/features/settings/components/staff-application-skeleton";

/**
 * useFieldArray מייצר מזהים עם crypto.randomUUID — ערך לא יציב שנדחה
 * ב-prerender, ולכן הטופס עצמו חייב לשבת מאחורי גבול Suspense.
 */
export default function StaffApplicationPage() {
  return (
    <Suspense fallback={<StaffPageSkeleton />}>
      <StaffApplicationForm />
    </Suspense>
  );
}
