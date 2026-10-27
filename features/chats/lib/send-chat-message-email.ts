import { readTemplateId, sendEmail } from "@/lib/email/send-email";
import {
  buildChatMessageEmail,
  CHAT_MESSAGE_TEMPLATE_ENV,
} from "@/lib/email/templates/chat-message";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasRole } from "@/lib/user-role";

/**
 * מייל לצד השני על הודעת צ'אט חדשה ששלח המשתמש. לקוד שרת בלבד (service role).
 *
 * נשלח רק כש:
 * - השולח משתתף בשיחה, וההודעה האחרונה בה היא שלו ונשלחה עכשיו (אחרת הנתיב
 *   היה ערוץ לשליחת מיילים בלי הודעה);
 * - הנמען אינו שדכן ואינו מנהל - המייל מיועד למנהלי כרטיסים, שלא תמיד נכנסים;
 * - לא נשלח לנמען מייל על השיחה הזו בחצי השעה האחרונה.
 */
const TAG = "[chats/email]";
const THROTTLE_MS = 30 * 60 * 1000;
/** ההודעה שעליה מודיעים נשלחה ממש עכשיו */
const FRESH_MESSAGE_MS = 2 * 60 * 1000;
const FALLBACK_SENDER_NAME = "משתמש/ת";

export type ChatEmailOutcome =
  | "sent"
  | "skipped"
  | "throttled"
  | "not_allowed"
  | "failed";

type AdminClient = ReturnType<typeof createAdminClient>;

async function loadSenderName(
  admin: AdminClient,
  senderId: string,
): Promise<string> {
  const { data } = await admin
    .from("user_profiles")
    .select("first_name, last_name")
    .eq("id", senderId)
    .maybeSingle();
  const name = `${data?.first_name ?? ""} ${data?.last_name ?? ""}`.trim();
  return name || FALLBACK_SENDER_NAME;
}

/** השולח כתב את ההודעה האחרונה בשיחה, לפני רגע */
async function isFreshMessageFrom(
  admin: AdminClient,
  roomId: string,
  senderId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("chat_messages")
    .select("sender_id, created_at")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data || data.sender_id !== senderId) return false;
  return Date.now() - new Date(data.created_at).getTime() < FRESH_MESSAGE_MS;
}

async function isThrottled(
  admin: AdminClient,
  roomId: string,
  recipientId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("chat_email_notices")
    .select("last_sent_at")
    .eq("room_id", roomId)
    .eq("user_id", recipientId)
    .maybeSingle();
  if (!data) return false;
  return Date.now() - new Date(data.last_sent_at).getTime() < THROTTLE_MS;
}

export async function sendChatMessageEmail(params: {
  roomId: string;
  senderId: string;
}): Promise<ChatEmailOutcome> {
  try {
    const admin = createAdminClient();
    const { data: room, error: roomError } = await admin
      .from("chat_rooms")
      .select("user_a, user_b, context_label")
      .eq("room_id", params.roomId)
      .maybeSingle();
    if (roomError) {
      console.error(`${TAG}: room lookup failed`, roomError.message);
      return "failed";
    }
    if (!room || ![room.user_a, room.user_b].includes(params.senderId)) {
      return "not_allowed";
    }
    if (!(await isFreshMessageFrom(admin, params.roomId, params.senderId))) {
      return "not_allowed";
    }

    const recipientId =
      room.user_a === params.senderId ? room.user_b : room.user_a;
    const { data: recipient, error: recipientError } =
      await admin.auth.admin.getUserById(recipientId);
    const recipientUser = recipient?.user;
    if (recipientError || !recipientUser?.email) {
      console.error(`${TAG}: no recipient email`, recipientError?.message);
      return "skipped";
    }
    if (hasRole(recipientUser, "shadchan") || hasRole(recipientUser, "admin")) {
      return "skipped";
    }
    if (await isThrottled(admin, params.roomId, recipientId)) {
      return "throttled";
    }

    const content = buildChatMessageEmail({
      senderName: await loadSenderName(admin, params.senderId),
      contextLabel: room.context_label ?? null,
      roomId: params.roomId,
    });
    const result = await sendEmail({
      to: recipientUser.email,
      subject: content.subject,
      text: content.text,
      html: content.html,
      templateId: readTemplateId(CHAT_MESSAGE_TEMPLATE_ENV),
      dynamicData: content.dynamicData,
    });
    if (!result.ok) {
      console.error(`${TAG}: send failed`, result.error);
      return "failed";
    }

    // נרשם גם כשהשליחה דולגה (פיתוח), כדי שההגבלה תיבדק גם שם
    const { error: markError } = await admin.from("chat_email_notices").upsert({
      room_id: params.roomId,
      user_id: recipientId,
      last_sent_at: new Date().toISOString(),
    });
    if (markError) {
      console.error(`${TAG}: throttle mark failed`, markError.message);
    }
    return "sent";
  } catch (error) {
    console.error(`${TAG}: unexpected failure`, error);
    return "failed";
  }
}
