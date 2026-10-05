import { NextRequest, NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/user";

// עריכה ומחיקה של "הערת שדכן". הכותב או מנהל בלבד - האכיפה האמיתית היא
// מדיניות ה-UPDATE/DELETE של RLS (הכותב או מנהל), והבדיקות כאן נותנות
// תשובה ברורה במקום "שורה לא נמצאה". פידבק איש צוות (author_role='staff')
// אינו נערך ואינו נמחק במסלול הזה.

const bodySchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "יש להזין תוכן")
    .max(2000, "הטקסט ארוך מדי (מקסימום 2000 תווים)"),
});

type RouteContext = {
  params: Promise<{ studentId: string; noteId: string }>;
};

async function requireShadchanOrAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!hasRole(user, "shadchan") && !hasRole(user, "admin")) {
    return {
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { supabase };
}

const NOT_FOUND = () =>
  NextResponse.json(
    { error: "ההערה לא נמצאה או שאין הרשאה לשנות אותה" },
    { status: 404 },
  );

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  noStore();

  const { studentId, noteId } = await params;
  const auth = await requireShadchanOrAdmin();
  if ("response" in auth) return auth.response;

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

  const { data: updated, error } = await auth.supabase
    .from("student_notes")
    .update({ body: parsed.data.body })
    .eq("id", noteId)
    .eq("student_id", studentId)
    .neq("author_role", "staff")
    .select("id, body, updated_at")
    .maybeSingle();

  if (error) {
    console.error("[students/notes] update", error);
    return NextResponse.json({ error: "שגיאה בשמירה" }, { status: 500 });
  }
  if (!updated) return NOT_FOUND();

  return NextResponse.json({ note: updated });
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  noStore();

  const { studentId, noteId } = await params;
  const auth = await requireShadchanOrAdmin();
  if ("response" in auth) return auth.response;

  const { data: deleted, error } = await auth.supabase
    .from("student_notes")
    .delete()
    .eq("id", noteId)
    .eq("student_id", studentId)
    .neq("author_role", "staff")
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[students/notes] delete", error);
    return NextResponse.json({ error: "שגיאה במחיקה" }, { status: 500 });
  }
  if (!deleted) return NOT_FOUND();

  return NextResponse.json({ ok: true });
}
