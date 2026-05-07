import { NextRequest, NextResponse } from "next/server";
import { callMicropay } from "@/lib/micropay";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPhoneVerificationEnabled } from "@/lib/system-settings";
import { unstable_noStore as noStore } from "next/cache";

export async function POST(req: NextRequest) {
  noStore();
  const phoneVerificationEnabled = await getPhoneVerificationEnabled();
  if (!phoneVerificationEnabled) {
    return NextResponse.json(
      { status: "DISABLED", message: "אימות טלפוני אינו פעיל במערכת" },
      { status: 403 },
    );
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { status: "ERROR", message: "Unauthorized" },
      { status: 401 },
    );
  }

  const alreadyVerified =
    user.phone_confirmed_at || user.user_metadata?.phone_verified === true;
  if (alreadyVerified) {
    return NextResponse.json(
      { status: "ERROR", message: "Phone already verified" },
      { status: 400 },
    );
  }

  // When user changed phone (pending verification), validate against the new number
  const phoneNumber =
    (user.user_metadata?.phone_verified === false &&
      (user.user_metadata?.phone as string | undefined)) ||
    user.phone ||
    (user.user_metadata?.phone as string | undefined);

  if (!phoneNumber) {
    return NextResponse.json(
      { status: "ERROR", message: "Phone number not found" },
      { status: 400 },
    );
  }

  try {
    const body = await req.json();
    const { otp } = body;

    if (!otp) {
      return NextResponse.json(
        { status: "ERROR", message: "OTP is required" },
        { status: 400 },
      );
    }

    const otpResult = await callMicropay("validate", phoneNumber, otp);
    if (otpResult.status !== "CODE_VALID") {
      const statusMap: Record<string, number> = {
        WRONG_CODE: 401,
        MAX_SENT: 429,
        ERROR: 502,
      };
      return NextResponse.json(
        {
          status: otpResult.status,
          message: otpResult.errorMessage || "OTP validation failed",
        },
        { status: statusMap[otpResult.status] ?? 500 },
      );
    }

    // Update user phone confirmation metadata
    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        phone_verified: true,
        phone_confirmed_at: new Date().toISOString(),
      },
    });

    if (updateError) {
      console.error("Failed to update phone confirmation:", updateError);
      return NextResponse.json(
        { status: "ERROR", message: "Failed to confirm phone" },
        { status: 500 },
      );
    }

    // Sync auth.users.phone so it matches the verified number (e.g. after change-phone flow)
    try {
      const adminClient = createAdminClient();
      const { error: adminError } = await adminClient.auth.admin.updateUserById(
        user.id,
        { phone: phoneNumber, phone_confirm: true },
      );
      if (adminError) {
        console.warn("Failed to sync auth.users.phone after verify:", adminError);
      }
    } catch (e) {
      console.warn("Admin client unavailable for phone sync:", e);
    }

    return NextResponse.json({ status: "CODE_VALID" });
  } catch (error) {
    console.error("OTP verify handler error", error);
    return NextResponse.json(
      { status: "ERROR", message: "Internal server error" },
      { status: 500 },
    );
  }
}
