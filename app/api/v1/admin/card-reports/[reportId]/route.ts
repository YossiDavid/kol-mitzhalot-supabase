import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/user";

const bodySchema = z.object({ status: z.literal("handled") });

/**
 * "סומן כטופל" לדיווח על כרטיס. מנהל בלבד: בדיקת התפקיד כאן, ובנוסף מדיניות
 * ה-RLS על card_reports מתירה עדכון למנהל בלבד. המטפל נלקח מהסשן.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const { reportId } = await params;
  if (!z.guid().safeParse(reportId).success) {
    return NextResponse.json({ error: "הדיווח לא נמצא" }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasRole(user, "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!bodySchema.safeParse(json).success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("card_reports")
    .update({
      status: "handled",
      handled_by: user.id,
      handled_at: new Date().toISOString(),
    })
    .eq("id", reportId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[admin/card-reports] update failed", reportId, error);
    return NextResponse.json({ error: "עדכון הדיווח נכשל" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "הדיווח לא נמצא" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
