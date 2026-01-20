import { NextRequest, NextResponse } from "next/server";
import { callMicropay } from "@/lib/micropay";
import { isValidILPhone, maskPhone, normalizePhoneKey } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { unstable_noStore as noStore } from 'next/cache';

type Counter = { count: number; resetAt: number };
const sendCounters = new Map<string, Counter>();
const MAX_PER_HOUR = 10;

function getClientIp(req: NextRequest) {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const [first] = fwd.split(",");
    if (first) return first.trim();
  }
  return req.headers.get("x-real-ip") ?? "unknown";
}

function getBucket(key: string) {
  const now = Date.now();
  const bucket = sendCounters.get(key);
  if (!bucket || now > bucket.resetAt) {
    const fresh = { count: 0, resetAt: now + 60 * 60 * 1000 };
    sendCounters.set(key, fresh);
    return fresh;
  }
  return bucket;
}

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

  if (!isValidILPhone(phoneNumber)) {
    return NextResponse.json(
      {
        status: "ERROR",
        message: "Invalid phone format. Use 05XXXXXXXX or 9725XXXXXXXX",
      },
      { status: 400 },
    );
  }

  const key = `${normalizePhoneKey(phoneNumber)}::${getClientIp(req)}`;
  const bucket = getBucket(key);
  if (bucket.count >= MAX_PER_HOUR) {
    return NextResponse.json(
      { status: "MAX_SENT", message: "Too many attempts" },
      { status: 429 },
    );
  }

  try {
    const result = await callMicropay("get", phoneNumber);

    switch (result.status) {
      case "CODE_SENT": {
        bucket.count += 1;
        console.log("[OTP] CODE_SENT phone=%s", maskPhone(phoneNumber));
        return NextResponse.json({ status: "CODE_SENT" });
      }
      case "MAX_SENT":
        console.warn("[OTP] MAX_SENT phone=%s", maskPhone(phoneNumber));
        return NextResponse.json({ status: "MAX_SENT" }, { status: 429 });
      default:
        console.warn(
          "[OTP] ERROR phone=%s reason=%s",
          maskPhone(phoneNumber),
          result.errorMessage,
        );
        return NextResponse.json(
          {
            status: "ERROR",
            message: result.errorMessage || "Micropay error",
          },
          { status: 502 },
        );
    }
  } catch (error) {
    console.error("OTP send handler error", error);
    return NextResponse.json(
      { status: "ERROR", message: "Internal server error" },
      { status: 500 },
    );
  }
}
