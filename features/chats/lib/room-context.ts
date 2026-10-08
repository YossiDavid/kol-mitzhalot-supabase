// הקשר של חדר צ'אט: כללי, כרטיס או הצעת שידוך. עמודות ההקשר ב-chat_rooms
// נקבעות רק ב-get_or_create_context_room; כאן רק קוראים אותן ומציגים.

import type { RoomContextKind } from "@/app/app/chats/types";

export type RoomContext = {
  kind: RoomContextKind;
  studentId: string | null;
  shidduchId: string | null;
  /** צילום השם ביצירה — כותרת גם כשהכרטיס/ההצעה כבר נמחקו */
  label: string | null;
};

export const GENERAL_THREAD_TITLE = "כללי";

function asString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function asKind(value: unknown): RoomContextKind {
  return value === "student" || value === "shidduch" ? value : "general";
}

/** שורת chat_rooms מהרשת. שורה ישנה בלי העמודות נחשבת כללית. */
export function parseRoomContext(row: unknown): RoomContext {
  const record =
    typeof row === "object" && row !== null
      ? (row as Record<string, unknown>)
      : {};
  return {
    kind: asKind(record.context_kind),
    studentId: asString(record.student_id),
    shidduchId: asString(record.shidduch_id),
    label: asString(record.context_label),
  };
}

/** כותרת השרשור ברשימה: "כללי", "כרטיס: <שם>" או "הצעה: <X ו-Y>". */
export function roomContextTitle(context: RoomContext): string {
  if (context.kind === "student") {
    return context.label ? `כרטיס: ${context.label}` : "כרטיס";
  }
  if (context.kind === "shidduch") {
    return context.label ? `הצעה: ${context.label}` : "הצעה";
  }
  return GENERAL_THREAD_TITLE;
}
