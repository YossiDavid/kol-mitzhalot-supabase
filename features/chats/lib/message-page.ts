// טעינת הודעות בעמודים: החדשות קודם, והישנות לפי דרישה (keyset). לוגיקה טהורה
// (בלי React ובלי supabase), כדי שאפשר יהיה להסביר ולבדוק אותה בנפרד.

import type { Message } from "@/app/app/chats/types";

/** כמה הודעות נטענות בפתיחת חדר, ובכל לחיצה על "טעינת הודעות קודמות" */
export const CHAT_PAGE_SIZE = 50;

/**
 * מצב ההודעות של חדר אחד. `roomId` מזהה למי ההודעות שייכות, כדי שעדכון
 * מאוחר של חדר שנסגר לא ידרוס את החדר הנוכחי.
 */
export type ThreadState = {
  roomId: string;
  /** מהישנה לחדשה */
  messages: Message[];
  /** יש עוד הודעות ישנות יותר מהישנה שנטענה */
  hasOlder: boolean;
  /** העמוד האחרון (העדכני) נטען; לפניו מוצג שלד */
  isLoaded: boolean;
  /** כמה פעמים נוספו הודעות ישנות בראש הרשימה - מסמן "לשמר גלילה" */
  olderLoads: number;
};

export function emptyThread(roomId: string): ThreadState {
  return {
    roomId,
    messages: [],
    hasOlder: false,
    isLoaded: false,
    olderLoads: 0,
  };
}

/** התנאי (PostgREST `or`) להודעות שקדמו להודעה הישנה ביותר שנטענה */
export function olderThanFilter(
  oldest: Pick<Message, "created_at" | "message_id">,
) {
  // הזמן נשלח כמחרוזת כפי שהתקבל מהשרת - בלי המרה ל-Date שחותכת מיקרו-שניות
  return `created_at.lt."${oldest.created_at}",and(created_at.eq."${oldest.created_at}",message_id.lt."${oldest.message_id}")`;
}

/**
 * שאילתת N+1 חדשות->ישנות מחזירה עמוד ועוד שורה אחת שמעידה שיש עוד.
 * מחזיר את ההודעות מהישנה לחדשה ואת הדגל.
 */
export function splitPage(
  rowsNewestFirst: readonly Message[],
  pageSize: number = CHAT_PAGE_SIZE,
): { messages: Message[]; hasOlder: boolean } {
  const hasOlder = rowsNewestFirst.length > pageSize;
  const page = rowsNewestFirst.slice(0, pageSize);
  return { messages: [...page].reverse(), hasOlder };
}

/** העמוד העדכני הגיע. הודעות realtime שהגיעו לפניו נשמרות (בלי כפילות) */
export function applyLatestPage(
  state: ThreadState,
  page: { messages: Message[]; hasOlder: boolean },
): ThreadState {
  const fetchedIds = new Set(page.messages.map((m) => m.message_id));
  const arrivedMeanwhile = state.messages.filter(
    (m) => !fetchedIds.has(m.message_id),
  );
  return {
    ...state,
    messages: [...page.messages, ...arrivedMeanwhile],
    hasOlder: page.hasOlder,
    isLoaded: true,
  };
}

/** עמוד של הודעות ישנות יותר מצורף בראש הרשימה, בלי הודעות שכבר נטענו */
export function applyOlderPage(
  state: ThreadState,
  page: { messages: Message[]; hasOlder: boolean },
): ThreadState {
  const knownIds = new Set(state.messages.map((m) => m.message_id));
  const fresh = page.messages.filter((m) => !knownIds.has(m.message_id));
  return {
    ...state,
    messages: [...fresh, ...state.messages],
    hasOlder: page.hasOlder,
    olderLoads: state.olderLoads + 1,
  };
}

/** הודעה חדשה מ-realtime: בסוף הרשימה, פעם אחת בלבד */
export function applyInsert(state: ThreadState, row: Message): ThreadState {
  if (state.messages.some((m) => m.message_id === row.message_id)) return state;
  return { ...state, messages: [...state.messages, row] };
}

/** עריכה מ-realtime; הודעה שלא נטענה (ישנה יותר) אינה מתווספת */
export function applyUpdate(state: ThreadState, row: Message): ThreadState {
  return {
    ...state,
    messages: state.messages.map((m) =>
      m.message_id === row.message_id ? row : m,
    ),
  };
}
