import { NextRequest, NextResponse } from "next/server";
import { callMicropay } from "@/lib/micropay";
import { createClient } from "@/lib/supabase/server";
import { unstable_noStore as noStore } from 'next/cache';

export async function POST(req: NextRequest) {
  noStore();
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

  if (user.phone_confirmed_at) {
    return NextResponse.json(
      { status: "ERROR", message: "Phone already verified" },
      { status: 400 },
    );
  }

  const phoneNumber = user.phone;

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

    return NextResponse.json({ status: "CODE_VALID" });
  } catch (error) {
    console.error("OTP verify handler error", error);
    return NextResponse.json(
      { status: "ERROR", message: "Internal server error" },
      { status: 500 },
    );
  }
}
