import { NextRequest, NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/user";

// שיוך המוני של מוסד לימודים לכרטיסי מיועדים קיימים (מסך
// app/app/admin/students/institutions). institutionId=null מנקה שיוך קיים.
const bodySchema = z.object({
  studentIds: z.array(z.string().uuid()).min(1).max(200),
  institutionId: z.string().uuid().nullable(),
});

export async function PATCH(req: NextRequest) {
  noStore();

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

  const { studentIds, institutionId } = parsed.data;
  const admin = createAdminClient();

  // הגנת מגדר בצד השרת: אין לסמוך על סינון הלקוח. מוסד עם מגדר אחד לא יכול
  // להשתייך לכרטיס עם מגדר אחר, גם אם הלקוח שלח בקשה שגויה. רלוונטי רק
  // כששמים שיוך (לא כשמנקים אותו).
  if (institutionId !== null) {
    const [
      { data: institution, error: institutionError },
      { data: students, error: studentsError },
    ] = await Promise.all([
      admin
        .from("institutions")
        .select("id, gender")
        .eq("id", institutionId)
        .maybeSingle(),
      admin
        .from("students")
        .select("id, gender")
        .in("id", studentIds)
        .is("deleted_at", null),
    ]);

    if (institutionError || studentsError) {
      console.error(
        "[admin/students/institution]",
        institutionError ?? studentsError,
      );
      return NextResponse.json(
        { error: "Failed to validate assignment" },
        { status: 500 },
      );
    }

    if (!institution) {
      return NextResponse.json(
        { error: "המוסד המבוקש לא נמצא" },
        { status: 404 },
      );
    }

    const mismatchedGenderStudent = (students ?? []).find(
      (student) => student.gender !== institution.gender,
    );
    if (mismatchedGenderStudent) {
      const institutionGenderLabel =
        institution.gender === "male" ? "בנים" : "בנות";
      return NextResponse.json(
        {
          error: `לא ניתן לשייך: המוסד מיועד ל${institutionGenderLabel} וברשימה יש כרטיסים במגדר אחר`,
        },
        { status: 409 },
      );
    }
  }

  const { data: updated, error: updateError } = await admin
    .from("students")
    .update({ institution_id: institutionId })
    .in("id", studentIds)
    .is("deleted_at", null)
    .select("id");

  if (updateError) {
    console.error("[admin/students/institution]", updateError);
    return NextResponse.json(
      { error: "Failed to update institution assignment" },
      { status: 500 },
    );
  }

  return NextResponse.json({ updated: updated?.length ?? 0 });
}
