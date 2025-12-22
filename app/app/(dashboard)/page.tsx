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

export default async function Home() {
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
            <Chat chats={[]} />
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

      {(isUser || isAdmin) && (
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
            subTitle="שאלות ותשובות חדשות שקיבלת משדכנים בצ’אט"
            button={<Button>למעבר לצ׳אט</Button>}
          >
            <UserChat chats={[]} />
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
