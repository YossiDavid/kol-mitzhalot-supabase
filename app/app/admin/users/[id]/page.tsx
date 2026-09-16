import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { Page, PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/card-skeleton";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";
import { ServiceRoleError } from "@/features/admin/components/service-role-error";
import { UserChildrenTable } from "@/features/admin/components/user-children-table";
import { UserRolesEditor } from "@/features/admin/components/user-roles-editor";
import {
  formatUserDate,
  getUserDetails,
  type UserDetails,
} from "@/features/admin/lib/user-details";
import { getRoleLabel } from "@/lib/user";

// מספר קופסאות השלד בזמן הטעינה - מקרב את מבנה הדף האמיתי (מידע, תפקידים,
// סטטיסטיקות וילדים) ומונע קפיצת פריסה.
const FALLBACK_SECTION_COUNT = 4;

type UserDetailsPageProps = {
  params: Promise<{ id: string }>;
};

function BackToUsersButton() {
  return (
    <Button asChild variant="outline">
      <Link href="/app/admin/users">חזרה לרשימת המשתמשים</Link>
    </Button>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className="text-muted-foreground">{label}</span> {children}
    </div>
  );
}

function BasicInfoCard({ userDetails }: { userDetails: UserDetails }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h2>מידע בסיסי</h2>
        </CardTitle>
      </CardHeader>
      <div className="grid grid-cols-2 gap-4">
        <DetailRow label="שם פרטי:">
          {userDetails.firstName || "לא זמין"}
        </DetailRow>
        <DetailRow label="שם משפחה:">
          {userDetails.lastName || "לא זמין"}
        </DetailRow>
        <DetailRow label="אימייל:">{userDetails.email || "לא זמין"}</DetailRow>
        <DetailRow label="טלפון:">{userDetails.phone || "לא זמין"}</DetailRow>
        <DetailRow label={userDetails.roles.length > 1 ? "תפקידים:" : "תפקיד:"}>
          {userDetails.roles.map(getRoleLabel).join(" · ")}
        </DetailRow>
        <DetailRow label="תאריך הצטרפות:">
          {formatUserDate(userDetails.createdAt)}
        </DetailRow>
        <DetailRow label="התחברות אחרונה:">
          {formatUserDate(userDetails.lastSignInAt)}
        </DetailRow>
      </div>
    </Card>
  );
}

async function UserDetailsContent({ params }: UserDetailsPageProps) {
  noStore();
  const { id } = await params;
  let userDetails: UserDetails | null = null;
  let error: Error | null = null;

  try {
    userDetails = await getUserDetails(id);
  } catch (err) {
    error = err instanceof Error ? err : new Error("Unknown error");
    console.error("Error in UserDetailsPage:", error);
  }

  if (error) {
    return (
      <Page>
        <PageHeader
          title="שגיאה"
          description="אירעה שגיאה בטעינת פרטי המשתמש"
          actions={<BackToUsersButton />}
        />
        <ServiceRoleError message={error.message} />
      </Page>
    );
  }

  if (!userDetails) {
    notFound();
  }

  return (
    <Page>
      <PageHeader
        title={`פרטי משתמש: ${userDetails.firstName} ${userDetails.lastName}`}
        description="מידע מפורט על המשתמש"
        actions={<BackToUsersButton />}
      />
      <div className="space-y-6">
        <BasicInfoCard userDetails={userDetails} />

        {/* עריכת תפקידים - משתמש יכול להיות גם וגם (למשל שדכן וגם איש צוות) */}
        <Card>
          <CardHeader>
            <CardTitle asChild>
              <h2>תפקידים</h2>
            </CardTitle>
          </CardHeader>
          <UserRolesEditor
            userId={userDetails.id}
            initialRoles={userDetails.roles}
            initialInstitutionId={userDetails.staffInstitutionId}
          />
        </Card>

        <Card>
          <CardHeader>
            <CardTitle asChild>
              <h2>סטטיסטיקות שידוכים</h2>
            </CardTitle>
          </CardHeader>
          <div className="grid grid-cols-2 gap-4">
            <DetailRow label={'סה"כ שידוכים שהוצעו:'}>
              <strong>{userDetails.shidduchimStats.totalOffered}</strong>
            </DetailRow>
            <DetailRow label={'סה"כ שידוכים שנסגרו:'}>
              <strong>{userDetails.shidduchimStats.totalCompleted}</strong>
            </DetailRow>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle asChild>
              <h2>ילדים במערכת ({userDetails.children.length})</h2>
            </CardTitle>
          </CardHeader>
          <UserChildrenTable
            rows={userDetails.children}
            byChild={userDetails.shidduchimStats.byChild}
          />
        </Card>
      </div>
    </Page>
  );
}

function UserDetailsFallback() {
  return (
    <Page>
      <PageHeader
        title="פרטי משתמש"
        description="מידע מפורט על המשתמש"
        actions={<BackToUsersButton />}
      />
      <SkeletonRegion className="space-y-6">
        {Array.from({ length: FALLBACK_SECTION_COUNT }).map((_, index) => (
          <CardSkeleton key={index} header={false}>
            <Skeleton className="h-6 w-40" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
            </div>
          </CardSkeleton>
        ))}
      </SkeletonRegion>
    </Page>
  );
}

export default function UserDetailsPage(props: UserDetailsPageProps) {
  return (
    <Suspense fallback={<UserDetailsFallback />}>
      <UserDetailsContent {...props} />
    </Suspense>
  );
}
