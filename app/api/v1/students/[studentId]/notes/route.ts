import { NextRequest, NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/user";

// יצירת מחמאה/הערה על כרטיס מיועד. שדכן/מנהל יכולים לכתוב על כל מיועד;
// איש צוות מאושר יכול לכתוב רק על מיועד השייך למוסד שלו - הבדיקה כאן
// נעשית דרך הלקוח המשויך למשתמש (RLS) כדי שהיא תהיה זהה בדיוק למה ש-RLS
// יאכוף בפועל על ה-INSERT עצמו, ולא רק כדי לתת הודעת שגיאה נחמדה.
const bodySchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "יש להזין תוכן להערה")
    .max(2000, "ההערה ארוכה מדי (מקסימום 2000 תווים)"),
});

export async function POST(
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

  const isShadchanOrAdmin = hasRole(user, "shadchan") || hasRole(user, "admin");

  if (!isShadchanOrAdmin) {
    if (!hasRole(user, "staff")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // דרך הלקוח המשויך למשתמש - RLS מגביל את התוצאה למיועדים שהמשתמש
    // הזה רשאי לראות (כולל התנאי staff_can_access_student). אם אין שורה,
    // איש הצוות לא שייך למוסד של המיועד הזה.
    const { data: visibleStudent, error: visibilityError } = await supabase
      .from("students")
      .select("id")
      .eq("id", studentId)
      .maybeSingle();

    if (visibilityError) {
      console.error("[students/notes]", visibilityError);
      return NextResponse.json(
        { error: "שגיאה בבדיקת הרשאות" },
        { status: 500 },
      );
    }

    if (!visibleStudent) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // הכנסה דרך הלקוח המשויך למשתמש (לא service role) - מדיניות ה-INSERT
  // של RLS היא האכיפה האמיתית כאן, לא רק הבדיקה למעלה.
  const { data: created, error: insertError } = await supabase
    .from("student_notes")
    .insert({
      student_id: studentId,
      author_id: user.id,
      body: parsed.data.body,
    })
    .select("id, student_id, author_id, body, created_at, updated_at")
    .single();

  if (insertError) {
    console.error("[students/notes]", insertError);
    return NextResponse.json(
      { error: "שגיאה בשמירת ההערה" },
      { status: 500 },
    );
  }

  return NextResponse.json({ note: created }, { status: 201 });
}
