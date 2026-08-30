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

  // אירוסין/נישואין מוציאים את הכרטיס משידוכים, וחזרה לרווק/גרוש/אלמן
  // מחזירה אותו. בלי הצד השני של התנאי, תיקון סטטוס שגוי היה משאיר את
  // הכרטיס עם in_shidduchim=false והוא היה נעלם מהרשימה בלי שאיש ישים לב.
  const isEngagedOrMarried = status === "engaged" || status === "married";

  const { data: updated, error: updateError } = await admin
    .from("students")
    .update({
      personal_status: status,
      status_changed_at: new Date().toISOString(),
      in_shidduchim: !isEngagedOrMarried,
    })
    .eq("id", studentId)
    .is("deleted_at", null)
    .select("id, personal_status, in_shidduchim, status_changed_at")
    .maybeSingle();

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
