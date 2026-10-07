import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { describeSupabaseError } from "@/lib/supabase/describe-error";
import { getForumAccess } from "./access";

/** קוד השגיאה של Postgres כשמדיניות RLS דוחה כתיבה */
const RLS_VIOLATION_CODE = "42501";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

type WriterResult =
  | { ok: true; supabase: SupabaseServer; userId: string }
  | { ok: false; response: NextResponse };

/**
 * מי רשאי לכתוב בפורום (פוסט, תגובה, לייק): שדכן מאושר או מנהל. הכתיבה עצמה
 * עוברת בלקוח של המשתמש ולא בלקוח מנהל, ולכן ה-RLS ב-DB הוא האוכף האמיתי
 * וזו רק בדיקה מוקדמת להודעה ברורה.
 */
export async function requireForumWriter(): Promise<WriterResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const access = await getForumAccess();
  if (access.status !== "allowed") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "הפורום פתוח לשדכנים מאושרים ולמנהלים בלבד" },
        { status: 403 },
      ),
    };
  }

  return { ok: true, supabase, userId: user.id };
}

export function forumWriteError(
  scope: string,
  error: {
    code?: string;
    message?: string;
    details?: string | null;
    hint?: string | null;
  },
): NextResponse {
  console.error(`[forums/${scope}]`, describeSupabaseError(error));
  if (error.code === RLS_VIOLATION_CODE) {
    return NextResponse.json(
      { error: "אין הרשאה לבצע את הפעולה בפורום" },
      { status: 403 },
    );
  }
  return NextResponse.json({ error: "הפעולה נכשלה, נסו שוב" }, { status: 500 });
}

/** מזהה בנתיב ה-API: אותה בדיקה לפוסט ולתגובה */
export const forumIdSchema = z.guid();

/**
 * מחיקת שורה מהפורום בלקוח של המשתמש. מדיניות ה-RLS (כותב התוכן או מנהל)
 * היא שמחליטה; אפס שורות = לא קיים או שאין הרשאה, ואין מבחינים ביניהם כדי
 * לא לחשוף קיום של תוכן. מחיקת פוסט מוחקת ב-cascade גם תגובות ולייקים.
 */
export async function deleteForumRow(
  table: "forum_posts" | "forum_replies",
  id: string,
): Promise<NextResponse> {
  const writer = await requireForumWriter();
  if (!writer.ok) return writer.response;

  const { data, error } = await writer.supabase
    .from(table)
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return forumWriteError(`delete-${table}`, error);

  if (!data || data.length === 0) {
    return NextResponse.json(
      { error: "הפריט לא נמצא, או שאין לך הרשאה למחוק אותו" },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true });
}
