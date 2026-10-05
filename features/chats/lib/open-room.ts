import { createClient } from "@/lib/supabase/client";
import { contactErrorMessage } from "@/features/shadchanim/lib/contact";

export type OpenRoomTarget =
  | { kind: "general" }
  | { kind: "student"; studentId: string }
  | { kind: "shidduch"; shidduchId: string };

/**
 * פותח (או מחזיר) חדר עם הקשר. ההרשאה נבדקת בשרת (get_or_create_context_room),
 * לעולם לא כאן. זורק את שגיאת Supabase כמות שהיא — למשל context_not_allowed
 * או daily_contact_limit_reached.
 */
export async function openContextRoom(
  otherUserId: string,
  target: OpenRoomTarget,
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_or_create_context_room", {
    other_user_id: otherUserId,
    p_context_kind: target.kind,
    p_student_id: target.kind === "student" ? target.studentId : null,
    p_shidduch_id: target.kind === "shidduch" ? target.shidduchId : null,
  });
  if (error) throw error;
  return data as string;
}

const OPEN_ROOM_ERRORS: Record<string, string> = {
  context_not_allowed: "אין הרשאה לפתוח את השיחה הזו.",
  invalid_context: "הכרטיס או ההצעה אינם זמינים לשיחה.",
  invalid_other_user: "לא ניתן לפתוח שיחה עם המשתמש הזה.",
};

/** הודעה בעברית לשגיאה מ-openContextRoom; מכסת הפניות מטופלת כמו בפנייה לשדכן. */
export function openRoomErrorMessage(error: unknown): string {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? error.message
      : null;
  return (
    (typeof message === "string" && OPEN_ROOM_ERRORS[message]) ||
    contactErrorMessage(error)
  );
}
