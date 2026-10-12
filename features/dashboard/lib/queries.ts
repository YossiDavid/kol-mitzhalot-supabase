import {
  parseRoomContext,
  roomContextTitle,
} from "@/features/chats/lib/room-context";
import { getDisplayName } from "@/features/chats/lib/user-display";
import type { ApplicationStatus } from "@/lib/application-status";
import { describeZodIssues } from "@/lib/describe-zod-issues";
import { describeSupabaseError } from "@/lib/supabase/describe-error";
import type { createClient } from "@/lib/supabase/server";
import {
  STUDENT_TABLE_COLUMNS,
  parseStudentTableRows,
} from "./student-table-rows";
import { STUDENT_CARDS_VIEW } from "@/features/students/lib/third-party-card";
import { shidduchIdsOf, splitChatsBySide } from "./chat-sides";

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

/**
 * מאמת את שורות הטבלה לפני שהן מגיעות לתצוגה. שורה שאינה תואמת (למשל שם
 * עמודה שהשתנה) נחשבת כשל טעינה, כמו שגיאת שליפה, ואינה נבלעת בשקט.
 */
function toStudentTableResult(data: unknown, logTag: string) {
  const parsed = parseStudentTableRows(data);
  if (!parsed.success) {
    console.error(
      logTag,
      "unexpected student rows",
      describeZodIssues(parsed.error.issues),
    );
    return { students: [], failed: true };
  }
  return { students: parsed.data, failed: false };
}

/**
 * המיועדים שהמשתמש סימן במועדפים. failed נפרד מרשימה ריקה: שליפה שנכשלה
 * מציגה "לא הצלחנו לטעון" ולא "עוד לא הוספת מועדפים"
 */
export async function getFavoriteStudents(
  supabase: ServerSupabase,
  favoriteIds: string[],
) {
  // בלי מועדפים אין מה לשלוף - התוצאה זהה לשאילתה על רשימה ריקה
  if (favoriteIds.length === 0) return { students: [], failed: false };

  const { data, error } = await supabase
    .from(STUDENT_CARDS_VIEW)
    .select(STUDENT_TABLE_COLUMNS)
    .in("id", favoriteIds);

  if (error) {
    console.error("[dashboard/favorites]", describeSupabaseError(error));
    return { students: [], failed: true };
  }
  return toStudentTableResult(data, "[dashboard/favorites]");
}

/** המיועדים שבניהול המשתמש. failed נפרד מרשימה ריקה (כמו במועדפים) */
export async function getOwnStudents(supabase: ServerSupabase, userId: string) {
  const { data, error } = await supabase
    .from(STUDENT_CARDS_VIEW)
    .select(STUDENT_TABLE_COLUMNS)
    .eq("user_id", userId);

  if (error) {
    console.error("[dashboard/own-students]", describeSupabaseError(error));
    return { students: [], failed: true };
  }
  return toStudentTableResult(data, "[dashboard/own-students]");
}

/** סטטוס בקשת ההצטרפות כשדכן של המשתמש; null כשאין שורה, או שהשליפה נכשלה */
export async function getShadchanApplicationStatus(
  supabase: ServerSupabase,
  userId: string,
): Promise<ApplicationStatus | null> {
  const { data, error } = await supabase
    .from("shadchanim_info")
    .select("application_status")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) console.error(error);
  const status = data?.application_status;
  return status === "pending" || status === "approved" || status === "rejected"
    ? status
    : null;
}

const SHIDDUCH_SIDE_COLUMNS = `
  first_name,
  last_name,
  birth_date,
  city,
  cv_url,
  parents_info,
  education_history(name),
  employment_history(category,role)
`;

/** "ההצעות האחרונות שלך" — הרשימה המלאה ב-/app/shadchan/proposals */
const RECENT_SHIDDUCHIM_LIMIT = 6;

/** השידוכים שהשדכן המחובר הציע (האחרונים). failed נפרד מרשימה ריקה */
export async function getRecentShidduchim(
  supabase: ServerSupabase,
  shadchanId: string,
) {
  const { data, error } = await supabase
    .from("shidduchim")
    .select(
      `
      id,
      note_for_groom,
      note_for_bride,
      status,
      created_at,
      updated_at,
      sent_at,
      recipient_scope,
      groom_id,
      bride_id,
      groom:${STUDENT_CARDS_VIEW}!shidduchim_groom_id_fkey(${SHIDDUCH_SIDE_COLUMNS}),
      bride:${STUDENT_CARDS_VIEW}!shidduchim_bride_id_fkey(${SHIDDUCH_SIDE_COLUMNS})
    `,
    )
    .eq("shadchan_id", shadchanId)
    .neq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(RECENT_SHIDDUCHIM_LIMIT);

  if (error) {
    console.error(
      "[dashboard/recent-shidduchim]",
      describeSupabaseError(error),
    );
    return { shidduchim: [], failed: true };
  }
  return { shidduchim: data ?? [], failed: false };
}

/** כלל ההצעות שהשדכן שלח, לא רק האחרונות שמוצגות. null כשהספירה נכשלה */
export async function getSentShidduchimCount(
  supabase: ServerSupabase,
  shadchanId: string,
): Promise<number | null> {
  const { count, error } = await supabase
    .from("shidduchim")
    .select("id", { count: "exact", head: true })
    .eq("shadchan_id", shadchanId)
    .neq("status", "draft");

  if (error) console.error(error);
  return count ?? null;
}

const FORUM_POSTS_LIMIT = 3;

/**
 * פוסטים אחרונים בפורום השדכנים. failed נפרד מרשימה ריקה: שליפה שנכשלה
 * מציגה "לא הצלחנו לטעון" ולא "עדיין אין הודעות"
 */
export async function getLatestForumPosts(supabase: ServerSupabase) {
  const { data, error } = await supabase
    .from("forum_posts")
    .select("id, title, content, created_at")
    .order("created_at", { ascending: false })
    .limit(FORUM_POSTS_LIMIT);

  if (error) {
    console.error("[dashboard/forum-posts]", describeSupabaseError(error));
    return { posts: [], failed: true };
  }
  return { posts: data ?? [], failed: false };
}

/** שורות החדרים, או null (אחרי רישום) כששליפתם נכשלה */
function chatRoomsOrNull<T>(
  data: T[] | null,
  error: Parameters<typeof describeSupabaseError>[0] | null,
): T[] | null {
  if (!error) return data;
  console.error("[dashboard/chat-rooms]", describeSupabaseError(error));
  return null;
}

/** חדרי הצ'אט של המשתמש, החדש קודם. שגיאה מחזירה null (שונה מרשימה ריקה) */
async function getChatRooms(supabase: ServerSupabase, userId: string) {
  // עמודות ההקשר (כללי/כרטיס/הצעה) מבדילות בין כמה שיחות עם אותו אדם
  const roomColumns =
    "room_id, user_a, user_b, last_message_id, context_kind, student_id, shidduch_id, context_label";

  // קודם החדרים שהמשתמש משתתף בהם
  const { data: participants, error: participantsError } = await supabase
    .from("chat_room_participants")
    .select("room_id, joined_at")
    .eq("user_id", userId)
    .is("deleted_before", null);

  if (participantsError) {
    console.error(
      "[dashboard/chat-participants]",
      describeSupabaseError(participantsError),
    );
    return null;
  }

  if (participants && participants.length > 0) {
    const { data, error } = await supabase
      .from("chat_rooms")
      .select(roomColumns)
      .in(
        "room_id",
        participants.map((p) => p.room_id),
      )
      .order("last_message_at", { ascending: false, nullsFirst: false });
    return chatRoomsOrNull(data, error);
  }

  // fallback: query by user_a/user_b directly
  const { data, error } = await supabase
    .from("chat_rooms")
    .select(roomColumns)
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .order("last_message_at", { ascending: false, nullsFirst: false });
  return chatRoomsOrNull(data, error);
}

/** ההודעה האחרונה של כל חדר, בשאילתה אחת. הודעה שלא נמצאה - חסרה מהמפה */
async function getLastMessagesById(
  supabase: ServerSupabase,
  messageIds: string[],
) {
  if (messageIds.length === 0) return new Map<string, LastMessage>();

  const { data, error } = await supabase
    .from("chat_messages")
    .select("message_id, content, created_at, sender_id")
    .in("message_id", messageIds);

  // ההודעות האחרונות הן קישוט לשורה: בלעדיהן השיחות עדיין מוצגות
  if (error) {
    console.error("[dashboard/last-messages]", describeSupabaseError(error));
  }

  return new Map((data ?? []).map((message) => [message.message_id, message]));
}

type LastMessage = {
  message_id: string;
  content: string | null;
  created_at: string | null;
};

type OtherUserMetadata = {
  firstName?: string;
  lastName?: string;
  email?: string;
  avatar_url?: string;
} | null;

async function getOtherUserMetadata(
  supabase: ServerSupabase,
  otherUserId: string,
): Promise<OtherUserMetadata> {
  try {
    const { data } = await supabase.rpc("get_user_metadata", {
      target_user_id: otherUserId,
    });
    return data as OtherUserMetadata;
  } catch {
    return null;
  }
}

/**
 * שורות הצ'אט בדשבורד: הצד השני, וההודעה האחרונה בחדר. failed נפרד
 * מרשימה ריקה: שליפת חדרים שנכשלה מציגה "לא הצלחנו לטעון"
 */
export async function getChatsWithLastMessage(
  supabase: ServerSupabase,
  userId: string,
) {
  const chatRooms = await getChatRooms(supabase, userId);
  if (!chatRooms) return { chats: [], failed: true };

  const messageIds = chatRooms.flatMap((room) =>
    room.last_message_id ? [room.last_message_id] : [],
  );

  // ההודעות ושמות הצד השני לא תלויים זה בזה - נשלפים במקביל
  const [lastMessages, chats] = await Promise.all([
    getLastMessagesById(supabase, messageIds),
    Promise.all(
      chatRooms.map(async (room) => {
        const otherUserId = room.user_a === userId ? room.user_b : room.user_a;
        if (!otherUserId) return null;
        return {
          room,
          userData: await getOtherUserMetadata(supabase, otherUserId),
        };
      }),
    ),
  ]);

  const rows = chats.flatMap((chat) => {
    if (!chat) return [];
    const { room, userData } = chat;
    const lastMsg = room.last_message_id
      ? lastMessages.get(room.last_message_id)
      : null;
    const context = parseRoomContext(room);
    return [
      {
        id: room.room_id,
        // שם תצוגה משותף לצ'אטים - לעולם לא uid
        name: getDisplayName(userData),
        description: "",
        image: userData?.avatar_url || "/placeholder-avatar.png",
        link: `/app/chats/${room.room_id}`,
        // שיחה כללית נראית כמו תמיד; רק כרטיס/הצעה מקבלים שורת הקשר
        contextTitle:
          context.kind === "general" ? null : roomContextTitle(context),
        // לסיווג השיחה לאזור בדשבורד (שדכן / אישי)
        context,
        lastMessage: lastMsg?.content ?? null,
        lastMessageTime: lastMsg?.created_at ?? null,
        lastMessageSender: null,
      },
    ];
  });
  return { chats: rows, failed: false };
}

/**
 * מתוך ההצעות הנתונות: אלה שהצופה הוא השדכן שלהן. שאילתה אחת דרך הלקוח של
 * המשתמש; הצעה ש-RLS מסתירה ממנו פשוט חסרה, והוא אינו השדכן שלה.
 */
async function getShadchanShidduchIds(
  supabase: ServerSupabase,
  userId: string,
  shidduchIds: string[],
): Promise<Set<string>> {
  if (shidduchIds.length === 0) return new Set();

  const { data, error } = await supabase
    .from("shidduchim")
    .select("id")
    .eq("shadchan_id", userId)
    .in("id", shidduchIds);

  if (error) {
    console.error(
      "[dashboard/shadchan-shidduchim]",
      describeSupabaseError(error),
    );
  }
  return new Set((data ?? []).map((row) => row.id));
}

/**
 * שיחות הדשבורד של שדכן/מנהל, מפוצלות לשיחות כשדכן ולשיחות כבעל כרטיס.
 * הפיצול נעשה על כל החדרים, כך שאף אזור אינו מורעב על ידי האחר.
 */
export async function getChatsBySide(
  supabase: ServerSupabase,
  userId: string,
  ownStudentIds: ReadonlySet<string>,
) {
  const { chats, failed } = await getChatsWithLastMessage(supabase, userId);
  const shadchanShidduchIds = await getShadchanShidduchIds(
    supabase,
    userId,
    shidduchIdsOf(chats),
  );
  return {
    ...splitChatsBySide(chats, ownStudentIds, shadchanShidduchIds),
    failed,
  };
}
