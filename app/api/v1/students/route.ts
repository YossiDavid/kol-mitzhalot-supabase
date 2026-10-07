import { NextResponse, type NextRequest } from "next/server";

import {
  createProfileLimiter,
  handleProfileSave,
  withoutClientUserId,
} from "@/features/students/lib/save-profile-server";

// יצירת כרטיס מיועד. הבעלים נקבע ב-RPC מ-auth.uid() של הסשן ולא מה-payload.
export async function POST(req: NextRequest) {
  return handleProfileSave(req, {
    label: "students/create",
    limiter: createProfileLimiter,
    call: (supabase, payload) =>
      supabase.rpc("create_full_student_profile", {
        payload: withoutClientUserId(payload),
      }),
    onSuccess: (data) =>
      typeof data === "string"
        ? NextResponse.json({ id: data }, { status: 201 })
        : NextResponse.json({ error: "לא התקבל מזהה כרטיס" }, { status: 500 }),
  });
}
