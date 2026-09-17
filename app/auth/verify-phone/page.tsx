import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import OTPSection from "./otp-section";
import { Suspense } from "react";
import { unstable_noStore as noStore } from "next/cache";
import { maskPhone } from "@/lib/phone";
import { getPhoneVerificationEnabled } from "@/lib/system-settings";
import { Spinner } from "@/components/ui/spinner";
import { sanitizeNextPath } from "@/features/auth/lib/next-path";

async function VerifyPhoneContent({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  noStore();
  // היעד שממנו הגיע המשתמש (app/app/layout.tsx או טופס הפרופיל), כדי
  // שקישור עמוק ממייל לא יאבד בשער אימות הטלפון.
  const nextPath = sanitizeNextPath((await searchParams).next);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const phoneVerificationEnabled = await getPhoneVerificationEnabled();
  if (!phoneVerificationEnabled) {
    redirect(nextPath);
  }

  if (user?.user_metadata?.phone_verified === true) {
    redirect(nextPath);
  }

  const phoneNumber =
    (user?.user_metadata?.phone_verified === false &&
      (user?.user_metadata?.phone as string | undefined)) ||
    user?.phone ||
    (user?.user_metadata?.phone as string | undefined);
  const hasPhone = !!phoneNumber;
  const maskedPhone = phoneNumber ? maskPhone(phoneNumber) : null;

  return (
    <OTPSection hasPhone={hasPhone} maskedPhone={maskedPhone} next={nextPath} />
  );
}

export default function PageWrapper({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  return (
    <Suspense fallback={<Spinner />}>
      <VerifyPhoneContent searchParams={searchParams} />
    </Suspense>
  );
}
