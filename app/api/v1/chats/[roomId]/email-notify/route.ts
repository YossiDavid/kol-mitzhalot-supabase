import { NextResponse } from "next/server";
import { z } from "zod";

import { sendChatMessageEmail } from "@/features/chats/lib/send-chat-message-email";
import { createClient } from "@/lib/supabase/server";

/**
 * אחרי שליחת הודעת צ'אט: מייל לצד השני, אם הוא מנהל כרטיס (לא שדכן/מנהל) ולא
 * קיבל מייל על השיחה בחצי השעה האחרונה. כל הבדיקות ב-sendChatMessageEmail;
 * השולח נלקח מהסשן ולא מהגוף.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params;
  if (!z.guid().safeParse(roomId).success) {
    return NextResponse.json({ error: "מזהה שיחה לא תקין" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "נדרשת התחברות" }, { status: 401 });
  }

  const outcome = await sendChatMessageEmail({ roomId, senderId: user.id });
  if (outcome === "not_allowed") {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }
  if (outcome === "failed") {
    return NextResponse.json({ error: "שליחת המייל נכשלה" }, { status: 500 });
  }
  return NextResponse.json({ outcome });
}
