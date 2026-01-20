import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";
import { PasswordForm } from "./password-form";
import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from 'next/cache';

export default async function SettingsPage() {
  noStore();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const userMetadata = user.user_metadata || {};

  const initialData = {
    firstName: userMetadata.firstName || null,
    lastName: userMetadata.lastName || null,
    email: user.email || null,
  };

  return (
    <div className="container mx-auto max-w-2xl py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">הגדרות</h1>
          <p className="text-muted-foreground mt-2">
            נהל את הגדרות החשבון והפרופיל שלך
          </p>
        </div>
        <ProfileForm initialData={initialData} />
        <PasswordForm />
      </div>
    </div>
  );
}
