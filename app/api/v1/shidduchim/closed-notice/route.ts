import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { CLOSED_NOTICE_MAX_LENGTH } from "@/features/shidduchim/lib/closed-notice";
import { SHIDDUCH_SIDES } from "@/features/shidduchim/lib/responses";
import { sendClosedNoticeEmail } from "@/features/notifications/lib/send-closed-notice-email";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * "עדכון הצד השני": השדכן (או מנהל) מודיע לצד שקיבל את ההצעה שהיא ירדה
 * מהפרק. ההרשאה, בדיקת הנמענות, התיעוד וההתראה בפעמון נעשים ב-
 * public.send_shidduch_closed_notice (auth.uid() של הסשן); כאן רק ולידציה,
 * מיפוי שגיאות ושליחת המייל. כשל במייל אינו מכשיל: ההודעה כבר תועדה
 * והופיעה בפעמון, והתשובה מדווחת emailSent.
 */

const bodySchema = z.object({
  shidduchId: z.guid(),
  side: z.enum(SHIDDUCH_SIDES),
  message: z
    .string()
    .trim()
    .min(1, "ההודעה ריקה")
    .max(CLOSED_NOTICE_MAX_LENGTH, "ההודעה ארוכה מדי"),
});

const RPC_ERRORS: Record<string, { status: number; error: string }> = {
  authentication_required: { status: 401, error: "יש להתחבר מחדש" },
  shidduch_not_found: { status: 404, error: "ההצעה לא נמצאה" },
  not_shadchan: { status: 403, error: "רק שדכן ההצעה או מנהל יכולים לעדכן" },
  side_not_recipient: {
    status: 409,
    error: "ההצעה לא נשלחה לצד שנבחר",
  },
  recipient_not_found: {
    status: 409,
    error: "לא נמצא מנהל כרטיס לצד שנבחר",
  },
  shadchan_role_required: {
    status: 403,
    error: "אין לך כרגע הרשאת שדכן או מנהל לשלוח עדכון",
  },
  proposal_still_active: {
    status: 409,
    error: "אפשר לעדכן רק על הצעה שירדה מהפרק (נדחתה)",
  },
  notice_already_sent: {
    status: 429,
    error: "כבר נשלח עדכון לצד הזה ב-24 השעות האחרונות",
  },
  daily_limit_reached: {
    status: 429,
    error: "הגעת למכסת העדכונים היומית. נסו שוב מחר",
  },
  invalid_side: { status: 400, error: "צד לא תקין" },
  message_required: { status: 400, error: "ההודעה ריקה" },
  message_too_long: { status: 400, error: "ההודעה ארוכה מדי" },
};

type NoticeRow = { notice_id: string; recipient_user_id: string };

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { shidduchId, side, message } = parsed.data;

  const { data, error } = await supabase.rpc("send_shidduch_closed_notice", {
    p_shidduch_id: shidduchId,
    p_side: side,
    p_message: message,
  });

  if (error) {
    const known = RPC_ERRORS[error.message];
    if (known) {
      return NextResponse.json(
        { error: known.error },
        { status: known.status },
      );
    }
    console.error("[shidduchim/closed-notice] rpc failed", {
      shidduchId,
      side,
      error,
    });
    return NextResponse.json({ error: "שליחת העדכון נכשלה" }, { status: 500 });
  }

  const notice = (data as NoticeRow[] | null)?.[0];
  if (!notice) {
    console.error("[shidduchim/closed-notice] rpc returned no row", {
      shidduchId,
    });
    return NextResponse.json({ error: "שליחת העדכון נכשלה" }, { status: 500 });
  }

  // שדכן שהוא גם בעל הכרטיס בצד היעד לא מקבל מייל על הודעה של עצמו
  if (notice.recipient_user_id === user.id) {
    return NextResponse.json({ ok: true, emailSent: false });
  }

  // שם בעל ההצעה במייל: השדכן של ההצעה, גם כשמנהל הוא ששלח
  const { data: shidduch } = await createAdminClient()
    .from("shidduchim")
    .select("shadchan_id")
    .eq("id", shidduchId)
    .maybeSingle();

  const emailSent = await sendClosedNoticeEmail({
    noticeId: notice.notice_id,
    recipientUserId: notice.recipient_user_id,
    shadchanId: shidduch?.shadchan_id ?? user.id,
    message,
  });

  return NextResponse.json({ ok: true, emailSent });
}
