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

  const isShadchan = hasRole(user, "shadchan");
  const isAdmin = hasRole(user, "admin");

  // הכשירות (author_role) נקבעת אך ורק בשרת, לפי תפקידי המשתמש האמיתיים -
  // לעולם לא מתקבלת מהלקוח. סדר עדיפות כאשר למשתמש כמה תפקידים בו-זמנית:
  // שדכן > מנהל > איש צוות (זהה לסדר ב-lib/user-role.ts).
  let authorRole: "shadchan" | "admin" | "staff" | null = null;
  let authorInstitutionId: string | null = null;

  if (isShadchan) {
    authorRole = "shadchan";
  } else if (isAdmin) {
    authorRole = "admin";
  } else if (hasRole(user, "staff")) {
    authorRole = "staff";

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

    // מוסד הלימודים של איש הצוות בזמן הכתיבה - נשמר כתמונת מצב על ההערה
    // (ראה supabase/migrations/20260830170000_student_notes.sql). נשלף מתוך
    // בקשת ההצטרפות המאושרת בלבד - איש צוות שאין לו בקשה מאושרת עם מוסד
    // כבר לא היה מגיע לכאן (staff_can_access_student דורש את זה).
    const { data: staffInfo, error: staffInfoError } = await supabase
      .from("staff_info")
      .select("institution_id")
      .eq("user_id", user.id)
      .eq("application_status", "approved")
      .maybeSingle();

    if (staffInfoError) {
      console.error("[students/notes]", staffInfoError);
      return NextResponse.json(
        { error: "שגיאה בבדיקת שיוך המוסד" },
        { status: 500 },
      );
    }

    authorInstitutionId = staffInfo?.institution_id ?? null;
  }

  if (!authorRole) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // הכנסה דרך הלקוח המשויך למשתמש (לא service role) - מדיניות ה-INSERT
  // של RLS היא האכיפה האמיתית כאן, לא רק הבדיקה למעלה. institutions(...)
  // נשלף יחד עם השורה כדי שהתצוגה האופטימית בלקוח (StudentNotes) תוכל
  // להציג את שיוך המחבר מיד, בלי צורך ברענון.
  const { data: created, error: insertError } = await supabase
    .from("student_notes")
    .insert({
      student_id: studentId,
      author_id: user.id,
      body: parsed.data.body,
      author_role: authorRole,
      author_institution_id: authorInstitutionId,
    })
    .select(
      "id, student_id, author_id, body, created_at, updated_at, author_role, author_institution_id, institutions(name, city, type)",
    )
    .single();

  if (insertError) {
    console.error("[students/notes]", insertError);
    return NextResponse.json({ error: "שגיאה בשמירת ההערה" }, { status: 500 });
  }

  // PostgREST מחזיר את ה-embed כאובייקט יחיד (יחס many-to-one), אך ה-SDK
  // מקליד אותו כמערך כשאין Database type - מנרמלים לאיבר הראשון בלבד
  // (זהה לדפוס ב-features/settings/components/staff-card.tsx).
  const authorInstitution = Array.isArray(created.institutions)
    ? (created.institutions[0] ?? null)
    : created.institutions;

  return NextResponse.json(
    { note: { ...created, institutions: authorInstitution } },
    { status: 201 },
  );
}
