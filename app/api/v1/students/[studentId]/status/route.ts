import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveRole } from "@/lib/user";

const PERSONAL_STATUS_VALUES = [
  "single",
  "divorced",
  "widowed",
  "engaged",
  "married",
] as const;

const bodySchema = z.object({
  status: z.enum(PERSONAL_STATUS_VALUES),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const { studentId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = getEffectiveRole(user);
  if (role !== "admin" && role !== "shadchan") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { status } = parsed.data;
  const admin = createAdminClient();

  const { data: updated, error: updateError } = await admin
    .from("students")
    .update({ personal_status: status })
    .eq("id", studentId)
    .select("id, personal_status")
    .single();

  if (updateError || !updated) {
    console.error(updateError);
    return NextResponse.json(
      { error: "Failed to update status" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, row: updated });
}
