import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  handleProfileSave,
  updateProfileLimiter,
  withoutClientUserId,
} from "@/features/students/lib/save-profile-server";

// עריכת כרטיס. ההרשאה (בעלים / שדכן / מנהל) נאכפת ב-RPC לפי auth.uid().
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const { studentId } = await params;
  if (!z.uuid().safeParse(studentId).success) {
    return NextResponse.json({ error: "מזהה כרטיס לא תקין" }, { status: 400 });
  }

  return handleProfileSave(req, {
    label: "students/update",
    limiter: updateProfileLimiter,
    call: (supabase, payload) =>
      supabase.rpc("update_full_student_profile", {
        p_student_id: studentId,
        payload: withoutClientUserId(payload),
      }),
    onSuccess: () => NextResponse.json({ ok: true }),
  });
}
