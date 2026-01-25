import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import OTPSection from "./otp-section";
import { Suspense } from "react";
import { unstable_noStore as noStore } from "next/cache";

async function VerifyPhoneContent() {
  noStore();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.user_metadata?.phone_verified === true) {
    redirect("/app");
  }

  const hasPhone = !!(user?.phone || user?.user_metadata?.phone);

  return <OTPSection hasPhone={hasPhone} />;
}

export default function PageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
          <div className="w-full max-w-sm">
            <div>טוען...</div>
          </div>
        </div>
      }
    >
      <VerifyPhoneContent />
    </Suspense>
  );
}
