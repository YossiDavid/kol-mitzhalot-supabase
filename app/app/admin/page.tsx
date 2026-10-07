import { Suspense } from "react";

import { Page, PageHeader } from "@/components/layout";
import {
  DashboardGlance,
  DashboardGlanceSkeleton,
} from "@/features/admin/components/dashboard/dashboard-glance";
import {
  DashboardPending,
  DashboardPendingSkeleton,
} from "@/features/admin/components/dashboard/dashboard-pending";
import {
  DashboardWelcome,
  DashboardWelcomeSkeleton,
} from "@/features/admin/components/dashboard/dashboard-welcome";

// לוח הבקרה: דף פתיחה בסגנון וורדפרס. הניווט בין אזורי הניהול הוא בסיידבר
// (ובמובייל - בתפריט שנפתח מההדר).
export default function AdminPage() {
  return (
    <Page>
      <PageHeader title="לוח הבקרה" />
      <Suspense fallback={<DashboardWelcomeSkeleton />}>
        <DashboardWelcome />
      </Suspense>
      <Suspense fallback={<DashboardPendingSkeleton />}>
        <DashboardPending />
      </Suspense>
      <Suspense fallback={<DashboardGlanceSkeleton />}>
        <DashboardGlance />
      </Suspense>
    </Page>
  );
}
