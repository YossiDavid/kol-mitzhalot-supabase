import { NextRequest, NextResponse } from "next/server";
import { callMicropay } from "@/lib/micropay";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPhoneVerificationEnabled } from "@/lib/system-settings";
import { resolveUserPhone } from "@/lib/phone";
import { isPhoneVerified } from "@/lib/phone-verification";
import { createRateLimiter } from "@/lib/rate-limit";
import { unstable_noStore as noStore } from "next/cache";

const VERIFY_FAILURE_MESSAGES: Record<string, string> = {
  WRONG_CODE: "הקוד שגוי. נסו שוב.",
  MAX_SENT: "יותר מדי ניסיונות. נסו שוב מאוחר יותר.",
};

const VERIFY_WINDOW_MS = 15 * 60 * 1000;
const MAX_VERIFY_ATTEMPTS_PER_WINDOW = 10;
const verifyAttemptsPerUser = createRateLimiter({
  limit: MAX_VERIFY_ATTEMPTS_PER_WINDOW,
  windowMs: VERIFY_WINDOW_MS,
});

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

  if (isPhoneVerified(user)) {
    return NextResponse.json(
      { status: "ERROR", message: "Phone already verified" },
      { status: 400 },
    );
  }

  if (!verifyAttemptsPerUser.allow(user.id)) {
    return NextResponse.json(
      { status: "MAX_SENT", message: "Too many attempts" },
      { status: 429 },
    );
  }

  const phoneNumber = resolveUserPhone(user);

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
          message:
            VERIFY_FAILURE_MESSAGES[otpResult.status] ??
            "האימות נכשל. נסו שוב.",
        },
        { status: statusMap[otpResult.status] ?? 500 },
      );
    }

    // סימון האימות ב-app_metadata - נכתב רק כאן, ב-service role (המשתמש לא
    // יכול לכתוב אותו). GoTrue ממזג את app_metadata, כך שהתפקידים נשמרים.
    const adminClient = createAdminClient();
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      user.id,
      {
        app_metadata: {
          verified_phone: phoneNumber,
          phone_verified_at: new Date().toISOString(),
        },
      },
    );

    if (updateError) {
      console.error("Failed to update phone confirmation:", updateError);
      return NextResponse.json(
        { status: "ERROR", message: "Failed to confirm phone" },
        { status: 500 },
      );
    }

    // Sync auth.users.phone so it matches the verified number (e.g. after change-phone flow)
    try {
      const { error: adminError } = await adminClient.auth.admin.updateUserById(
        user.id,
        { phone: phoneNumber, phone_confirm: true },
      );
      if (adminError) {
        console.warn(
          "Failed to sync auth.users.phone after verify:",
          adminError,
        );
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
