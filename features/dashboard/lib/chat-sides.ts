import type { RoomContext } from "@/features/chats/lib/room-context";

/** באיזה אזור בדשבורד השיחה מוצגת: כשדכן, או כבעל כרטיס (הורה) */
export type ChatSide = "shadchan" | "personal";

/**
 * מסווגת חדר צ'אט עבור הצופה. פונקציה טהורה: כל הנתונים מגיעים כארגומנטים.
 *  - הצעה: הצופה הוא השדכן שלה -> "shadchan"; אחרת הוא מנהל כרטיס בהצעה -> "personal".
 *  - כרטיס: הכרטיס של הצופה -> "personal"; כרטיס של מישהו אחר -> "shadchan".
 *  - שיחה כללית -> "shadchan".
 */
export function classifyChatRoom(
  context: Pick<RoomContext, "kind" | "studentId" | "shidduchId">,
  ownStudentIds: ReadonlySet<string>,
  shadchanShidduchIds: ReadonlySet<string>,
): ChatSide {
  if (context.kind === "shidduch") {
    const isViewerTheShadchan =
      context.shidduchId !== null &&
      shadchanShidduchIds.has(context.shidduchId);
    return isViewerTheShadchan ? "shadchan" : "personal";
  }
  if (context.kind === "student") {
    const isOwnCard =
      context.studentId !== null && ownStudentIds.has(context.studentId);
    return isOwnCard ? "personal" : "shadchan";
  }
  return "shadchan";
}

/** מפצלת שיחות לשני האזורים; כל שיחה מופיעה באחד בלבד, והסדר נשמר */
export function splitChatsBySide<T extends { context: RoomContext }>(
  chats: readonly T[],
  ownStudentIds: ReadonlySet<string>,
  shadchanShidduchIds: ReadonlySet<string>,
): Record<ChatSide, T[]> {
  const isPersonal = (chat: T) =>
    classifyChatRoom(chat.context, ownStudentIds, shadchanShidduchIds) ===
    "personal";
  return {
    shadchan: chats.filter((chat) => !isPersonal(chat)),
    personal: chats.filter(isPersonal),
  };
}

/** מזהי ההצעות שמופיעות בחדרי הצ'אט (ללא כפילויות) */
export function shidduchIdsOf(
  chats: readonly { context: RoomContext }[],
): string[] {
  const ids = chats.flatMap(({ context }) =>
    context.kind === "shidduch" && context.shidduchId
      ? [context.shidduchId]
      : [],
  );
  return [...new Set(ids)];
}
