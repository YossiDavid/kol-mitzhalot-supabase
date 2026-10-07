import { Page, PageHeader } from "@/components/layout";
import {
  ShadchanArea,
  type ShadchanAreaProps,
} from "@/features/dashboard/components/shadchan-area";
import { PersonalArea } from "@/features/dashboard/components/personal-area";
import { getShadchanimWhoActedForMe } from "@/features/shadchanim/lib/queries";
import { createClient } from "@/lib/supabase/server";
import {
  getChatsBySide,
  getChatsWithLastMessage,
  getFavoriteStudents,
  getShadchanApplicationStatus,
  getLatestForumPosts,
  getOwnStudents,
  getRecentShidduchim,
  getSentShidduchimCount,
} from "@/features/dashboard/lib/queries";
import { getMyProposals } from "@/features/shidduchim/lib/proposals-data";
import type { StudentTableRow } from "@/features/students/components/students-table";
import { ShadchanJoinBanner } from "@/features/dashboard/components/user/shadchan-join-banner";
import { shadchanJoinPrompt } from "@/features/dashboard/lib/shadchan-join-prompt";
import { readSignupPurpose } from "@/features/auth/lib/signup-purpose";
import { getUser, hasRole } from "@/lib/user";
import DashboardSkeleton from "@/features/dashboard/components/dashboard-skeleton";
import { unstable_noStore as noStore } from "next/cache";
import { Suspense } from "react";

const OPEN_PROPOSALS_LIMIT = 5;

type DashboardChats = Awaited<ReturnType<typeof getChatsBySide>>;
type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

const EMPTY_CHATS: DashboardChats = { shadchan: [], personal: [] };

/** שדכן/מנהל מקבלים פיצול לשני אזורים; משתמש רגיל - כל השיחות באזור האישי */
async function loadChats(
  supabase: ServerSupabase,
  userId: string,
  isShadchanView: boolean,
  ownStudentsPromise: Promise<unknown[]>,
): Promise<DashboardChats> {
  if (!isShadchanView) {
    return {
      shadchan: [],
      personal: await getChatsWithLastMessage(supabase, userId),
    };
  }
  const ownStudents = await ownStudentsPromise;
  const ownStudentIds = new Set(
    ownStudents.flatMap((student) => {
      const id = (student as { id?: unknown }).id;
      return typeof id === "string" ? [id] : [];
    }),
  );
  return getChatsBySide(supabase, userId, ownStudentIds);
}

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

  const signupPurpose = user ? readSignupPurpose(user) : null;
  const needsShadchanApplicationStatus =
    shadchanJoinPrompt({
      signupPurpose,
      isShadchanOrAdmin: isShadchanView,
      applicationStatus: null,
    }) !== "none";

  // הכרטיסים של המשתמש נשלפים פעם אחת: הם גם מציגים את מקטע הכרטיסים וגם
  // מסווגים את השיחות (כרטיס שלי = שיחה אישית)
  const ownStudentsPromise = user?.id
    ? getOwnStudents(supabase, user.id)
    : Promise.resolve([]);

  // כל הסקשנים בלתי תלויים זה בזה, ולכן נשלפים במקביל. כל שליפה מטפלת
  // בשגיאה שלה (רישום + ערך ריק), כך שתקלה בסקשן אחד לא מפילה את האחרים.
  const [
    favoritesStudentsData,
    childrenData,
    activeShidduchimData,
    activeShidduchimCountRaw,
    openProposals,
    forumPostsData,
    chats,
    shadchanApplicationStatus,
  ] = await Promise.all([
    // מיועדים שעניינו אותך והוספת ללוח העבודה - מוצגים לשדכן ולמנהל בלבד
    isShadchanView ? getFavoriteStudents(supabase, favorites) : [],
    // הכרטיסים שבבעלות המשתמש
    ownStudentsPromise,
    // השידוכים שהשדכן המחובר הציע
    user?.id && isShadchanView ? getRecentShidduchim(supabase, user.id) : [],
    // המספר בכותרת הוא כלל ההצעות שנשלחו, ולא רק האחרונות שמוצגות
    user?.id && isShadchanView ? getSentShidduchimCount(supabase, user.id) : 0,
    // הצעות פתוחות שנשלחו למיועדים של המשתמש (כמנהל כרטיס) - החדשות קודם
    user?.id
      ? getMyProposals(supabase, {
          openOnly: true,
          limit: OPEN_PROPOSALS_LIMIT,
        })
      : [],
    // פוסטים אחרונים בפורום השדכנים
    isShadchanView ? getLatestForumPosts(supabase) : [],
    // חדרי הצ'אט של המשתמש עם ההודעה האחרונה בכל חדר, מפוצלים לשיחות כשדכן
    // ולשיחות כבעל כרטיס (לשדכן/מנהל); למשתמש רגיל הכול באזור אחד
    user?.id
      ? loadChats(supabase, user.id, isShadchanView, ownStudentsPromise)
      : EMPTY_CHATS,
    // רק מי שנרשם כדי להיות שדכן ועדיין אינו שדכן צריך את סטטוס הבקשה
    user?.id && needsShadchanApplicationStatus
      ? getShadchanApplicationStatus(supabase, user.id)
      : null,
  ]);

  // select עם רשימת עמודות מפורשת מבלבל את הסקת הטיפוסים של supabase-js
  const ownCards = childrenData as unknown as StudentTableRow[];

  const { shadchan: shadchanChats, personal: personalChats } = chats;

  // שדכן/מנהל בלי כרטיסים: האם יש בכלל שדכנים שפעלו בשבילו. רק אז נדרשת
  // השליפה, והיא מסתירה את המקטע רק כשחזרה רשימה ריקה (שגיאה - לא מסתירים)
  const hasNoShadchanim =
    isShadchanView && ownCards.length === 0
      ? (await getShadchanimWhoActedForMe(1))?.length === 0
      : false;

  const joinPrompt = shadchanJoinPrompt({
    signupPurpose,
    isShadchanOrAdmin: isShadchanView,
    applicationStatus: shadchanApplicationStatus,
  });

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

      {joinPrompt !== "none" && <ShadchanJoinBanner prompt={joinPrompt} />}

      {isShadchanView && (
        <ShadchanArea
          activeShidduchim={
            activeShidduchimData as unknown as ShadchanAreaProps["activeShidduchim"]
          }
          activeShidduchimCount={activeShidduchimCount}
          favorites={
            favoritesStudentsData as unknown as ShadchanAreaProps["favorites"]
          }
          chats={shadchanChats}
          forumPosts={forumPostsData}
        />
      )}

      {/* מקטעי הורה/בעל כרטיס – לכל משתמש מחובר (כולל כשהתפקיד לא מוגדר) */}
      {user && (
        <PersonalArea
          isInsideArea={isShadchanView}
          openProposals={openProposals}
          chats={personalChats}
          ownCards={ownCards}
          hasNoShadchanim={hasNoShadchanim}
        />
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
