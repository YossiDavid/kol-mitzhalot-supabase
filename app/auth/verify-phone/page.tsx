import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import OTPSection from "./otp-section";
import { Suspense } from "react";
import { unstable_noStore as noStore } from "next/cache";
import { maskPhone } from "@/lib/phone";
import { getPhoneVerificationEnabled } from "@/lib/system-settings";
import { Spinner } from "@/components/ui/spinner";

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
    <Suspense fallback={<Spinner />}>
      <VerifyPhoneContent />
    </Suspense>
  );
}
