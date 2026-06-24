import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/features/settings/components/profile-form";
import { PasswordForm } from "@/features/settings/components/password-form";
import { ShadchanCard } from "@/features/settings/components/shadchan-card";
import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { getPhoneVerificationEnabled } from "@/lib/system-settings";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ required?: string }>;
}) {
  noStore();
  const sp = await searchParams;
  const nameRequired = sp.required === "name";
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
    <div className="container mx-auto max-w-2xl py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">הגדרות</h1>
          <p className="text-muted-foreground mt-2">
            נהל את הגדרות החשבון והפרופיל שלך
          </p>
        </div>
        {nameRequired && (
          <div
            className="border-primary/30 bg-primary/5 text-foreground rounded-lg border px-4 py-3 text-sm"
            role="status"
          >
            נא להשלים שם פרטי ושם משפחה כדי להמשיך לשימוש באפליקציה.
          </div>
        )}
        <ProfileForm
          initialData={initialData}
          phoneVerificationEnabled={phoneVerificationEnabled}
        />
        <PasswordForm />
        <ShadchanCard />
      </div>
    </div>
  );
}
