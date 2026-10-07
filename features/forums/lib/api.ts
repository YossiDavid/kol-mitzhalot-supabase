import { NextResponse } from "next/server";
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
