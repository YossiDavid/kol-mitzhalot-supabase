import { NextRequest, NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveRole } from "@/lib/user";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  noStore();

  const { studentId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = getEffectiveRole(user);
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();

  const { data: updated, error: updateError } = await admin
    .from("students")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: user.id,
    })
    .eq("id", studentId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (updateError) {
    console.error("[admin/students/delete]", updateError);
    return NextResponse.json(
      { error: "Failed to delete student" },
      { status: 500 },
    );
  }

  if (!updated) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
