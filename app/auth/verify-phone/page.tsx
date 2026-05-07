import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import OTPSection from "./otp-section";
import { Suspense } from "react";
import { unstable_noStore as noStore } from "next/cache";
import { maskPhone } from "@/lib/phone";
import { getPhoneVerificationEnabled } from "@/lib/system-settings";

async function VerifyPhoneContent() {
  noStore();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const phoneVerificationEnabled = await getPhoneVerificationEnabled();
  if (!phoneVerificationEnabled) {
    redirect("/app");
  }

  if (user?.user_metadata?.phone_verified === true) {
    redirect("/app");
  }

  const phoneNumber =
    (user?.user_metadata?.phone_verified === false &&
      (user?.user_metadata?.phone as string | undefined)) ||
    user?.phone ||
    (user?.user_metadata?.phone as string | undefined);
  const hasPhone = !!phoneNumber;
  const maskedPhone = phoneNumber ? maskPhone(phoneNumber) : null;

  return <OTPSection hasPhone={hasPhone} maskedPhone={maskedPhone} />;
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
