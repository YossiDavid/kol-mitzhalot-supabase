import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import OTPSection from "./otp-section";

export const dynamic = "force-dynamic";

export default async function PageWrapper() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.user_metadata.phone_verified === true) {
    redirect("/app");
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <OTPSection />
      </div>
    </div>
  );
}
