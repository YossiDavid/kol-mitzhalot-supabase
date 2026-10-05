import { DashboardSection, Page, PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  ActiveShidduchim,
  Favorites,
  Chat,
  Forum,
} from "@/features/dashboard/components/shadchan";
import {
  ActiveShidduchim as UserActiveShidduchim,
  ShadchanimList,
  Children,
  Chat as UserChat,
} from "@/features/dashboard/components/user";
import { createClient } from "@/lib/supabase/server";
import {
  getChatsWithLastMessage,
  getFavoriteStudents,
  getLatestForumPosts,
  getOwnStudents,
  getRecentShidduchim,
  getSentShidduchimCount,
} from "@/features/dashboard/lib/queries";
import { getMyProposals } from "@/features/shidduchim/lib/proposals-data";
import { getUser, hasRole } from "@/lib/user";
import DashboardSkeleton from "@/features/dashboard/components/dashboard-skeleton";
import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { Suspense } from "react";

const OPEN_PROPOSALS_LIMIT = 5;

async function DashboardSections() {
  noStore();
  const supabase = await createClient();

  // ממוזכר לבקשה: המעטפת (layout) כבר שלפה את המשתמש, ובלי זה היינו
  // פונים שוב לשרת האימות
  const user = await getUser();

  const isAdmin = hasRole(user, "admin");
  const isShadchan = hasRole(user, "shadchan");

  const isShadchanView = Boolean(user?.id && (isShadchan || isAdmin));
  const favorites: string[] = user?.user_metadata?.favorites || [];

  // כל הסקשנים בלתי תלויים זה בזה, ולכן נשלפים במקביל. כל שליפה מטפלת
  // בשגיאה שלה (רישום + ערך ריק), כך שתקלה בסקשן אחד לא מפילה את האחרים.
  const [
    favoritesStudentsData,
    childrenData,
    activeShidduchimData,
    activeShidduchimCountRaw,
    openProposals,
    forumPostsData,
    chatsWithLastMessage,
  ] = await Promise.all([
    // מיועדים שעניינו אותך והוספת ללוח העבודה - מוצגים לשדכן ולמנהל בלבד
    isShadchanView ? getFavoriteStudents(supabase, favorites) : [],
    // הילדים שלך
    user?.id ? getOwnStudents(supabase, user.id) : [],
    // השידוכים שהשדכן המחובר הציע
    user?.id && isShadchanView ? getRecentShidduchim(supabase, user.id) : [],
    // המספר בכותרת הוא כלל ההצעות שנשלחו, ולא רק האחרונות שמוצגות
    user?.id && isShadchanView ? getSentShidduchimCount(supabase, user.id) : 0,
    // הצעות פתוחות שנשלחו לילדי המשתמש (כמנהל כרטיס) - החדשות קודם
    user?.id
      ? getMyProposals(supabase, {
          openOnly: true,
          limit: OPEN_PROPOSALS_LIMIT,
        })
      : [],
    // פוסטים אחרונים בפורום השדכנים
    isShadchanView ? getLatestForumPosts(supabase) : [],
    // חדרי הצ'אט של המשתמש עם ההודעה האחרונה בכל חדר
    user?.id ? getChatsWithLastMessage(supabase, user.id) : [],
  ]);

  const activeShidduchimCount =
    activeShidduchimCountRaw ?? activeShidduchimData.length;

  const firstName = user?.user_metadata?.firstName as string | undefined;
  const roleLabel = isAdmin ? "מנהל" : isShadchan ? "שדכן" : "משתמש";

  return (
    <>
      {/* ברכה: גלויה במובייל. בדסקטופ הברכה כבר בכותרת העליונה, והכותרת
          נשארת לקוראי מסך בלבד - כך לכל עמוד יש h1 אחד */}
      <PageHeader
        className="md:sr-only"
        title={`שלום${firstName ? `, ${firstName}` : ""}`}
        description={`ברוך הבא למערכת קול מצהלות · ${roleLabel}`}
      />

      {(isShadchan || isAdmin) && (
        <>
          <DashboardSection
            title="שידוכים באויר"
            titleNumber={activeShidduchimCount.toString()}
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
            <Forum posts={forumPostsData} />
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
            <UserActiveShidduchim shiduchim={openProposals} />
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
            title="המיועדים שלך"
            subTitle="מגיל 17 ועד החתונה בעז”ה"
            button={
              <Button asChild>
                <Link href="/app/students/create">להוספת מיועד/ת</Link>
              </Button>
            }
          >
            <Children childs={childrenData as any} />
          </DashboardSection>
          <DashboardSection
            title="שדכנים שפעלו בשבילך"
            subTitle="שדכנים שהציעו שידוכים או צפו בקו”ח של המיועדים שלך"
            button={
              <Button asChild>
                <Link href="/app/shadchanim">לכל השדכנים</Link>
              </Button>
            }
          >
            <ShadchanimList />
          </DashboardSection>
        </>
      )}
    </>
  );
}

export default function Home() {
  return (
    <Page className="gap-10">
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardSections />
      </Suspense>
    </Page>
  );
}
