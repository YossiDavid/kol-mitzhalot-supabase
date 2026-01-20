import { DashboardSection } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { ActiveShidduchim, Favorites, Chat, Forum } from "./sections/shadchan";
import {
  ActiveShidduchim as UserActiveShidduchim,
  ShadchanimList,
  Children,
  Chat as UserChat,
} from "./sections/user";
import { createClient } from "@/lib/supabase/server";
import { unstable_noStore as noStore } from 'next/cache';

export default async function Home() {
  noStore();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAdmin = user?.user_metadata?.role === "admin";
  const isShadchan = user?.user_metadata?.role === "shadchan";
  const isUser = user?.user_metadata?.role === "user";

  // מיועדים שעניינו אותך והוספת ללוח העבודה
  const favorites = user?.user_metadata?.favorites || [];
  const favoritesStudents = await supabase
    .from("students")
    .select(
      `*,
      education_history(*),
      employment_history(*),
      medical_records(*),
      partner_preferences(*),
      references(*),
      previous_partners(*)
    `,
    )
    .in("id", favorites);

  if (favoritesStudents.error) {
    console.error(favoritesStudents.error);
  }

  const favoritesStudentsData = favoritesStudents.data || [];

  // הילדים שלך
  const children = await supabase
    .from("students")
    .select(
      `*,
      education_history(*),
      employment_history(*),
      medical_records(*),
      partner_preferences(*),
      references(*),
      previous_partners(*)
    `,
    )
    .eq("user_id", user?.id);

  if (children.error) {
    console.error(children.error);
  }

  const childrenData = children.data || [];

  // נשלוף את כל חדרי הצ'אט של המשתמש עם ההודעה האחרונה בכל חדר, כולל פרטי השולח
  let chatRooms = null;
  let chatRoomsError = null;

  if (user?.id) {
    // נשלוף את כל החדרים שהמשתמש משתתף בהם
    const { data: participants, error: participantsError } = await supabase
      .from("chat_room_participants")
      .select("room_id, joined_at")
      .eq("user_id", user.id)
      .is("deleted_before", null);

    if (participantsError) {
      console.error("Error fetching participants:", participantsError);
      chatRoomsError = participantsError;
    } else {
      console.log("Participants found:", participants?.length || 0);

      if (participants && participants.length > 0) {
        const roomIds = participants.map((p) => p.room_id);
        console.log("Room IDs:", roomIds);

        // נשלוף את פרטי החדרים (ללא ההודעות - נשתמש ב-last_message_id)
        const { data: roomsData, error: roomsError } = await supabase
          .from("chat_rooms")
          .select("*")
          .in("room_id", roomIds)
          .order("last_message_at", { ascending: false, nullsFirst: false });

        if (roomsError) {
          console.error("Error fetching rooms:", roomsError);
          chatRoomsError = roomsError;
        } else {
          console.log("Rooms found:", roomsData?.length || 0);
          chatRooms = roomsData;
        }
      } else {
        // אם אין participants, ננסה דרך user_a/user_b (fallback)
        console.log("No participants found, trying user_a/user_b fallback");
        const { data: roomsData, error: roomsError } = await supabase
          .from("chat_rooms")
          .select("*")
          .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
          .order("last_message_at", { ascending: false, nullsFirst: false });

        if (roomsError) {
          console.error("Error fetching rooms (fallback):", roomsError);
          chatRoomsError = roomsError;
        } else {
          console.log("Rooms found (fallback):", roomsData?.length || 0);
          chatRooms = roomsData;
        }
      }
    }
  }

  // נמצא את ההודעה האחרונה בכל חדר, ונשלוף אליה את פרטי השולח והמשתמש השני
  const chatsWithLastMessage = [];
  if (chatRooms) {
    console.log("Processing", chatRooms.length, "rooms");
    for (const room of chatRooms) {
      // נמצא את המשתמש השני בחדר
      const otherUserId = room.user_a === user?.id ? room.user_b : room.user_a;

      // אם אין משתמש שני, נדלג על החדר הזה
      if (!otherUserId) continue;

      // נשלוף את שם המשתמש השני
      let otherUserName = "Unknown User";
      let otherUserAvatar = null;
      try {
        const { data: userData, error: rpcError } = await supabase.rpc(
          "get_user_metadata",
          {
            target_user_id: otherUserId,
          },
        );

        if (!rpcError && userData) {
          if (userData.firstName || userData.lastName) {
            otherUserName = `${userData.firstName || ""} ${
              userData.lastName || ""
            }`.trim();
          } else if (userData.email) {
            otherUserName = userData.email.split("@")[0];
          }
          otherUserAvatar = userData.avatar_url || null;
        }
      } catch (e) {
        console.error("Error fetching user name:", e);
        otherUserName = otherUserId.substring(0, 8);
      }

      // נשלוף את ההודעה האחרונה באמצעות last_message_id
      let lastMessage = null;
      let lastMessageContent = null;
      let lastMessageTime = null;
      let senderDetails = null;

      if (room.last_message_id) {
        const { data: lastMsg, error: lastMsgError } = await supabase
          .from("chat_messages")
          .select("message_id, content, created_at, sender_id")
          .eq("message_id", room.last_message_id)
          .single();

        if (!lastMsgError && lastMsg) {
          lastMessage = lastMsg;
          lastMessageContent = lastMsg.content;
          lastMessageTime = lastMsg.created_at;
        }
      }

      if (lastMessage?.sender_id) {
        // נשלוף מידע על השולח באמצעות RPC function
        try {
          const { data: senderData, error: senderError } = await supabase.rpc(
            "get_user_metadata",
            {
              target_user_id: lastMessage.sender_id,
            },
          );

          if (!senderError && senderData) {
            senderDetails = {
              id: lastMessage.sender_id,
              full_name:
                senderData.firstName || senderData.lastName
                  ? `${senderData.firstName || ""} ${
                      senderData.lastName || ""
                    }`.trim()
                  : null,
              email: senderData.email || null,
              avatar_url: null, // user_profiles doesn't have avatar_url
            };
          }
        } catch (e) {
          console.error("Error fetching sender details:", e);
        }
      }

      chatsWithLastMessage.push({
        id: room.room_id,
        name: otherUserName,
        description: "",
        image: otherUserAvatar || "/placeholder-avatar.png",
        link: `/app/chats/${room.room_id}`,
        lastMessage: lastMessageContent || null,
        lastMessageTime: lastMessageTime,
        lastMessageSender: senderDetails
          ? senderDetails.full_name || senderDetails.email || null
          : null,
      });
    }
    console.log("Total chats processed:", chatsWithLastMessage.length);
  } else {
    console.log("No chat rooms found");
  }

  console.log(
    "User role - isUser:",
    isUser,
    "isShadchan:",
    isShadchan,
    "isAdmin:",
    isAdmin,
  );
  console.log(
    "chatsWithLastMessage to render:",
    chatsWithLastMessage.length,
    chatsWithLastMessage,
  );

  return (
    <div className="space-y-10 py-4">
      {(isShadchan || isAdmin) && (
        <>
          <DashboardSection
            title="שידוכים באויר"
            subTitle="ההצעות האחרונות שלך"
            button={<Button>לכל ההצעות שלך</Button>}
          >
            <ActiveShidduchim shiduchim={[]} />
          </DashboardSection>
          <DashboardSection
            title="המועדפים שלך"
            subTitle="מיועדים שעניינו אותך והוספת ללוח העבודה"
            button={<Button>ללוח העבודה</Button>}
          >
            <Favorites favorites={favoritesStudentsData as any} />
          </DashboardSection>
          <DashboardSection
            title="הצ'אטים שלך"
            subTitle="הצ'אטים האחרונים שלך"
            button={<Button>לכל הצ'אטים שלך</Button>}
          >
            <Chat chats={chatsWithLastMessage as any} />
          </DashboardSection>
          <DashboardSection
            title="הפורומים שלך"
            subTitle="הפורומים האחרונים שלך"
            button={<Button>לכל הפורומים שלך</Button>}
          >
            <Forum forums={[]} />
          </DashboardSection>
        </>
      )}

      {(isUser || isShadchan || isAdmin) && (
        <>
          <DashboardSection
            title="הצעות פתוחות"
            subTitle="הצעות חדשות או מתקדמות שממתינות לטיפולך"
            button={<Button>לכל ההצעות</Button>}
          >
            <UserActiveShidduchim shiduchim={[]} />
          </DashboardSection>
          <DashboardSection
            title="הודעות אחרונות"
            subTitle="שאלות ותשובות חדשות שקיבלת משדכנים בצ'אט"
            button={<Button>למעבר לצ׳אט</Button>}
          >
            <UserChat chats={chatsWithLastMessage as any} />
          </DashboardSection>
          <DashboardSection
            title="הילדים שלך"
            subTitle="מגיל 17 ועד החתונה בעז”ה"
            button={<Button>להוספת בן / בת</Button>}
          >
            <Children childs={childrenData as any} />
          </DashboardSection>
          <DashboardSection
            title="שדכנים שפעלו בשבילך"
            subTitle="שדכנים שהציעו שידוכים או צפו בקו”ח של ילדיך"
            button={<Button>לכל השדכנים</Button>}
          >
            <ShadchanimList shadchanim={[]} />
          </DashboardSection>
        </>
      )}
    </div>
  );
}
