import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  PERSONAL_STATUS_VALUES,
  setStudentPersonalStatus,
} from "@/features/engagements/lib/set-student-personal-status";
import { hasRole } from "@/lib/user";

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

  if (!hasRole(user, "admin") && !hasRole(user, "shadchan")) {
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

  const { data: updated, error: updateError } = await setStudentPersonalStatus(
    admin,
    studentId,
    status,
  );

  if (updateError) {
    console.error(updateError);
    return NextResponse.json(
      { error: "Failed to update status" },
      { status: 500 },
    );
  }

  if (!updated) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, row: updated });
}
