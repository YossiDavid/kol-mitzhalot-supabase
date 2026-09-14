import { NextRequest, NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import type { User } from "@supabase/supabase-js";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/user";

// יצירת "הערת שדכן" (פרטית לכותב) או "פידבק איש צוות" (גלוי בשיתוף הכרטיס).
// הסוג נבחר במפורש, כי למשתמש יכולים להיות גם תפקיד שדכן וגם איש צוות.
// author_role נגזר בשרת מהסוג ומהתפקידים האמיתיים - לעולם לא מהלקוח - ומדיניות
// ה-INSERT של RLS היא האכיפה האמיתית (כולל שיוך איש הצוות למוסד של המיועד).
const NOTE_KINDS = ["shadchan_note", "staff_feedback"] as const;

/** קוד Postgres להפרת מדיניות RLS */
const RLS_VIOLATION_CODE = "42501";

const bodySchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "יש להזין תוכן")
    .max(2000, "הטקסט ארוך מדי (מקסימום 2000 תווים)"),
  kind: z.enum(NOTE_KINDS),
});

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

type AuthorResult =
  | { role: "shadchan" | "admin" | "staff"; institutionId: string | null }
  | { error: string; status: number };

const FORBIDDEN: AuthorResult = { error: "Forbidden", status: 403 };

function resolveShadchanAuthor(user: User): AuthorResult {
  if (hasRole(user, "shadchan"))
    return { role: "shadchan", institutionId: null };
  if (hasRole(user, "admin")) return { role: "admin", institutionId: null };
  return FORBIDDEN;
}

/**
 * איש צוות כותב פידבק רק על מיועד שהוא רשאי לראות. המוסד שנשמר על הפידבק
 * הוא המוסד של המיועד - staff_can_access_student ממילא דורש שאיש הצוות
 * משויך בדיוק אליו, כך שזה נכון גם לאיש צוות עם כמה מוסדות.
 */
async function resolveStaffAuthor(
  supabase: ServerSupabase,
  user: User,
  studentId: string,
): Promise<AuthorResult> {
  if (!hasRole(user, "staff")) return FORBIDDEN;

  const { data: student, error } = await supabase
    .from("students")
    .select("id, institution_id")
    .eq("id", studentId)
    .maybeSingle();

  if (error) {
    console.error("[students/notes] visibility check", error);
    return { error: "שגיאה בבדיקת הרשאות", status: 500 };
  }
  if (!student) return FORBIDDEN;

  return { role: "staff", institutionId: student.institution_id ?? null };
}

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

  const { body, kind } = parsed.data;
  const author =
    kind === "staff_feedback"
      ? await resolveStaffAuthor(supabase, user, studentId)
      : resolveShadchanAuthor(user);

  if ("error" in author) {
    return NextResponse.json(
      { error: author.error },
      { status: author.status },
    );
  }

  const { data: created, error: insertError } = await supabase
    .from("student_notes")
    .insert({
      student_id: studentId,
      author_id: user.id,
      body,
      author_role: author.role,
      author_institution_id: author.institutionId,
    })
    .select("id, body, created_at, institutions(name, city)")
    .single();

  if (insertError) {
    if (insertError.code === RLS_VIOLATION_CODE) {
      return NextResponse.json(
        { error: "אין הרשאה לכתוב על כרטיס זה" },
        { status: 403 },
      );
    }
    console.error("[students/notes]", insertError);
    return NextResponse.json({ error: "שגיאה בשמירה" }, { status: 500 });
  }

  // PostgREST מחזיר את ה-embed כאובייקט יחיד (many-to-one), אך ה-SDK מקליד
  // אותו כמערך כשאין Database type - מנרמלים לאיבר הראשון.
  const institution = Array.isArray(created.institutions)
    ? (created.institutions[0] ?? null)
    : created.institutions;

  return NextResponse.json(
    {
      note: {
        id: created.id,
        body: created.body,
        created_at: created.created_at,
        institution_name: institution?.name ?? null,
        institution_city: institution?.city ?? null,
      },
    },
    { status: 201 },
  );
}
