import { createClient } from "@/lib/supabase/server";
import { Page, PageHeader } from "@/components/layout";
import { ProfileForm } from "@/features/settings/components/profile-form";
import { ShadchanCard } from "@/features/settings/components/shadchan-card";
import { StaffCard } from "@/features/settings/components/staff-card";
import { Skeleton } from "@/components/ui/skeleton";
import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { getPhoneVerificationEnabled } from "@/lib/system-settings";
import { Suspense } from "react";

/** שדות הפרופיל: שם פרטי, שם משפחה, אימייל, טלפון. */
const PROFILE_FIELD_COUNT = 4;

/** שלד הטופס והכרטיסים, בגובה דומה לתוכן האמיתי כדי למנוע קפיצה. */
function SettingsContentSkeleton() {
  return (
    <div role="status" aria-label="טוען" className="space-y-6">
      <div className="space-y-4 rounded-xl border border-border p-6">
        <Skeleton className="h-6 w-32" />
        {Array.from({ length: PROFILE_FIELD_COUNT }, (_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
        <Skeleton className="h-9 w-28" />
      </div>
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  );
}

async function SettingsContent({
  searchParams,
}: {
  searchParams: Promise<{ required?: string }>;
}) {
  noStore();
  const sp = await searchParams;
  const missingIdentityField =
    sp.required === "name" || sp.required === "phone" ? sp.required : null;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const userMetadata = user.user_metadata || {};

  // להציג תמיד את המספר העדכני: להעדיף user_metadata.phone (נשמר בהגדרות + אחרי אימות), כי ב-session לפעמים user.phone עדיין ישן
  const phone =
    (userMetadata.phone as string | undefined) || user.phone || null;

  const initialData = {
    firstName: userMetadata.firstName || null,
    lastName: userMetadata.lastName || null,
    email: user.email || null,
    phone,
  };

  const phoneVerificationEnabled = await getPhoneVerificationEnabled();

  return (
    <>
      {missingIdentityField && (
        <div
          className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-body-sm text-foreground"
          role="status"
        >
          {missingIdentityField === "name"
            ? "נא להשלים שם פרטי ושם משפחה כדי להמשיך לשימוש באפליקציה."
            : "נא להשלים מספר טלפון כדי להמשיך לשימוש באפליקציה."}
        </div>
      )}
      <ProfileForm
        initialData={initialData}
        phoneVerificationEnabled={phoneVerificationEnabled}
      />
      <ShadchanCard />
      <StaffCard />
    </>
  );
}

export default function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ required?: string }>;
}) {
  return (
    <Page width="form">
      <PageHeader
        title="הגדרות"
        description="נהל את הגדרות החשבון והפרופיל שלך"
      />
      <Suspense fallback={<SettingsContentSkeleton />}>
        <SettingsContent searchParams={searchParams} />
      </Suspense>
    </Page>
  );
}
