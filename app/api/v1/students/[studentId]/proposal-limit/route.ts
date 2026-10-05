import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  PROPOSAL_LIMIT_MAX,
  PROPOSAL_LIMIT_MIN,
  PROPOSAL_LIMIT_PERIODS,
} from "@/features/students/lib/proposal-limit";
import { describeSupabaseError } from "@/lib/supabase/describe-error";
import { createClient } from "@/lib/supabase/server";

// מספר ותקופה באים יחד; שניהם null = ללא הגבלה
const bodySchema = z
  .object({
    count: z
      .number()
      .int()
      .min(PROPOSAL_LIMIT_MIN)
      .max(PROPOSAL_LIMIT_MAX)
      .nullable(),
    period: z.enum(PROPOSAL_LIMIT_PERIODS).nullable(),
  })
  .refine((body) => (body.count === null) === (body.period === null), {
    message: "יש לבחור גם מספר וגם תקופה, או לבטל את ההגבלה",
  });

/**
 * מנהל הכרטיס קובע לכמה הצעות הכרטיס פתוח בתקופה. העדכון רץ בסשן של
 * המשתמש ולכן מדיניות ה-UPDATE על students (בעל הכרטיס בלבד) היא ההרשאה;
 * שורה שלא עודכנה משמעה שהכרטיס אינו שלו.
 */
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

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "גוף הבקשה אינו תקין",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { count, period } = parsed.data;

  const { data: updated, error } = await supabase
    .from("students")
    .update({ proposal_limit_count: count, proposal_limit_period: period })
    .eq("id", studentId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .select("id, proposal_limit_count, proposal_limit_period")
    .maybeSingle();

  if (error) {
    console.error(
      "[students/proposal-limit] update failed",
      studentId,
      describeSupabaseError(error),
    );
    return NextResponse.json({ error: "שמירת ההגבלה נכשלה" }, { status: 500 });
  }

  if (!updated) {
    return NextResponse.json(
      { error: "הכרטיס לא נמצא או שאינו בניהולך" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, row: updated });
}
