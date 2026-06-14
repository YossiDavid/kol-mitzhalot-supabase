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
import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";

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

  // השידוכים שהשדכן המחובר הציע
  const activeShidduchimRes =
    user?.id && (isShadchan || isAdmin)
      ? await supabase
          .from("shidduchim")
          .select(
            `
            id,
            note_for_groom,
            note_for_bride,
            status,
            created_at,
            groom:students!shidduchim_groom_id_fkey(
              first_name,
              last_name,
              birth_date,
              city,
              cv_url,
              parents_info,
              education_history(name),
              employment_history(category,role)
            ),
            bride:students!shidduchim_bride_id_fkey(
              first_name,
              last_name,
              birth_date,
              city,
              cv_url,
              parents_info,
              education_history(name),
              employment_history(category,role)
            )
          `,
          )
          .eq("shadchan_id", user.id)
          .neq("status", "draft")
          .order("created_at", { ascending: false })
      : { data: [], error: null };

  if (activeShidduchimRes.error) {
    console.error(activeShidduchimRes.error);
  }
  const activeShidduchimData = activeShidduchimRes.data || [];

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
      chatRoomsError = participantsError;
    } else {
      if (participants && participants.length > 0) {
        const roomIds = participants.map((p) => p.room_id);

        const { data: roomsData, error: roomsError } = await supabase
          .from("chat_rooms")
          .select("*")
          .in("room_id", roomIds)
          .order("last_message_at", { ascending: false, nullsFirst: false });

        if (roomsError) {
          chatRoomsError = roomsError;
        } else {
          chatRooms = roomsData;
        }
      } else {
        // fallback: query by user_a/user_b directly
        const { data: roomsData, error: roomsError } = await supabase
          .from("chat_rooms")
          .select("*")
          .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
          .order("last_message_at", { ascending: false, nullsFirst: false });

        if (roomsError) {
          chatRoomsError = roomsError;
        } else {
          chatRooms = roomsData;
        }
      }
    }
  }

  // async-parallel: process all chat rooms concurrently instead of sequentially
  const chatsWithLastMessage = chatRooms
    ? (
        await Promise.all(
          chatRooms.map(async (room) => {
            const otherUserId =
              room.user_a === user?.id ? room.user_b : room.user_a;
            if (!otherUserId) return null;

            const [userMetaResult, lastMsgResult] = await Promise.all([
              Promise.resolve(
                supabase.rpc("get_user_metadata", {
                  target_user_id: otherUserId,
                }),
              ).catch(() => ({ data: null, error: null })),
              room.last_message_id
                ? supabase
                    .from("chat_messages")
                    .select("message_id, content, created_at, sender_id")
                    .eq("message_id", room.last_message_id)
                    .single()
                : Promise.resolve({ data: null, error: null }),
            ]);

            const userData = userMetaResult.data as {
              firstName?: string;
              lastName?: string;
              email?: string;
              avatar_url?: string;
            } | null;

            let otherUserName = otherUserId.substring(0, 8);
            if (userData?.firstName || userData?.lastName) {
              otherUserName =
                `${userData.firstName || ""} ${userData.lastName || ""}`.trim();
            } else if (userData?.email) {
              otherUserName = userData.email.split("@")[0];
            }

            const lastMsg = lastMsgResult.data;
            return {
              id: room.room_id,
              name: otherUserName,
              description: "",
              image: userData?.avatar_url || "/placeholder-avatar.png",
              link: `/app/chats/${room.room_id}`,
              lastMessage: lastMsg?.content ?? null,
              lastMessageTime: lastMsg?.created_at ?? null,
              lastMessageSender: null,
            };
          }),
        )
      ).filter(Boolean)
    : [];
  return (
    <div className="space-y-10 py-4">
      {(isShadchan || isAdmin) && (
        <>
          <DashboardSection
            title="שידוכים באויר"
            subTitle="ההצעות האחרונות שלך"
            button={
              <Button asChild>
                <Link href={"/app/shadchan/proposals" as any}>
                  לכל ההצעות שלך
                </Link>
              </Button>
            }
          >
            <ActiveShidduchim shiduchim={activeShidduchimData as any} />
          </DashboardSection>
          <DashboardSection
            title="המועדפים שלך"
            subTitle="מיועדים שעניינו אותך והוספת ללוח העבודה"
            button={
              <Button asChild>
                <Link href="/app/canvas">ללוח העבודה</Link>
              </Button>
            }
          >
            <Favorites favorites={favoritesStudentsData as any} />
          </DashboardSection>
          <DashboardSection
            title="הצ'אטים שלך"
            subTitle="הצ'אטים האחרונים שלך"
            button={
              <Button asChild>
                <Link href="/app/chats">לכל הצ'אטים שלך</Link>
              </Button>
            }
          >
            <Chat chats={chatsWithLastMessage as any} />
          </DashboardSection>
          <DashboardSection
            title="הפורומים שלך"
            subTitle="הפורומים האחרונים שלך"
            button={
              <Button asChild>
                <Link href={"/app/forums" as any}>לכל הפורומים שלך</Link>
              </Button>
            }
          >
            <Forum forums={[]} />
          </DashboardSection>
        </>
      )}

      {/* סקשנים למשתמש רגיל – מוצגים לכל משתמש מחובר (כולל כשהתפקיד לא מוגדר) */}
      {user && (
        <>
          <DashboardSection
            title="הצעות פתוחות"
            subTitle="הצעות חדשות או מתקדמות שממתינות לטיפולך"
            button={
              <Button asChild>
                <Link href={"/app/proposals" as any}>לכל ההצעות</Link>
              </Button>
            }
          >
            <UserActiveShidduchim shiduchim={[]} />
          </DashboardSection>
          <DashboardSection
            title="הודעות אחרונות"
            subTitle="שאלות ותשובות חדשות שקיבלת משדכנים בצ'אט"
            button={
              <Button asChild>
                <Link href="/app/chats">למעבר לצ׳אט</Link>
              </Button>
            }
          >
            <UserChat chats={chatsWithLastMessage as any} />
          </DashboardSection>
          <DashboardSection
            title="הילדים שלך"
            subTitle="מגיל 17 ועד החתונה בעז”ה"
            button={
              <Button asChild>
                <Link href="/app/students/create">להוספת בן / בת</Link>
              </Button>
            }
          >
            <Children childs={childrenData as any} />
          </DashboardSection>
          <DashboardSection
            title="שדכנים שפעלו בשבילך"
            subTitle="שדכנים שהציעו שידוכים או צפו בקו”ח של ילדיך"
            button={
              <Button asChild>
                <Link href="/app/shadchanim">לכל השדכנים</Link>
              </Button>
            }
          >
            <ShadchanimList shadchanim={[]} />
          </DashboardSection>
        </>
      )}
    </div>
  );
}
