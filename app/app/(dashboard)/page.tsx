import { Page, PageHeader } from "@/components/layout";
import { ShadchanArea } from "@/features/dashboard/components/shadchan-area";
import { PersonalArea } from "@/features/dashboard/components/personal-area";
import { getShadchanimWhoActedForMe } from "@/features/shadchanim/lib/queries";
import { createClient } from "@/lib/supabase/server";
import {
  getChatsBySide,
  getChatsWithLastMessage,
  getFavoriteStudents,
  getShadchanApplicationStatus,
  getStaffApplicationStatus,
  getLatestForumPosts,
  getOwnStudents,
  getPoolCounts,
  getRecentShidduchim,
  getSentShidduchimCount,
} from "@/features/dashboard/lib/queries";
import { readFavorites } from "@/features/students/lib/favorites";
import { getMyProposals } from "@/features/shidduchim/lib/proposals-data";
import { ShadchanJoinBanner } from "@/features/dashboard/components/user/shadchan-join-banner";
import { ContinueSignupCta } from "@/features/dashboard/components/user/continue-signup-cta";
import { continueSignupTarget } from "@/features/dashboard/lib/continue-signup";
import {
  shadchanJoinPrompt,
  staffJoinPrompt,
} from "@/features/dashboard/lib/shadchan-join-prompt";
import { readSignupPurpose } from "@/features/auth/lib/signup-purpose";
import { getUser, hasRole } from "@/lib/user";
import { ShadchanFrozenBanner } from "@/features/shadchanim/components/shadchan-frozen-notice";
import { getShadchanAccess } from "@/features/shadchanim/lib/shadchan-access";
import DashboardSkeleton from "@/features/dashboard/components/dashboard-skeleton";
import { unstable_noStore as noStore } from "next/cache";
import { Suspense } from "react";

const OPEN_PROPOSALS_LIMIT = 5;

type DashboardChats = Awaited<ReturnType<typeof getChatsBySide>>;
type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

/** כמה פריטים מוצגים בכל מקטע תמצית (צ'אטים, מועדפים) */
const DASHBOARD_PREVIEW_LIMIT = 5;

const EMPTY_CHATS: DashboardChats = {
  shadchan: [],
  personal: [],
  failed: false,
};

/** שדכן/מנהל מקבלים פיצול לשני אזורים; משתמש רגיל - כל השיחות באזור האישי */
async function loadChats(
  supabase: ServerSupabase,
  userId: string,
  isShadchanView: boolean,
  ownStudentsPromise: Promise<{ students: unknown[] }>,
): Promise<DashboardChats> {
  if (!isShadchanView) {
    const { chats, failed } = await getChatsWithLastMessage(supabase, userId);
    return {
      shadchan: [],
      personal: chats,
      failed,
    };
  }
  const { students: ownStudents } = await ownStudentsPromise;
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
  // שדכן מוקפא רואה את העמוד כמשתמש רגיל, עם באנר שמסביר את ההקפאה
  const shadchanAccess = await getShadchanAccess(user);
  const isShadchan = shadchanAccess === "active";

  const isShadchanView = Boolean(user?.id && (isShadchan || isAdmin));
  const favorites = readFavorites(user);

  const signupPurpose = user ? readSignupPurpose(user) : null;
  const needsShadchanApplicationStatus =
    shadchanJoinPrompt({
      signupPurpose,
      isShadchanOrAdmin: isShadchanView,
      applicationStatus: null,
    }) !== "none";

  const isStaffOrAdmin = hasRole(user, "staff") || isAdmin;
  const needsStaffApplicationStatus =
    staffJoinPrompt({
      signupPurpose,
      isStaffOrAdmin,
      applicationStatus: null,
    }) !== "none";

  // הכרטיסים של המשתמש נשלפים פעם אחת: הם גם מציגים את מקטע הכרטיסים וגם
  // מסווגים את השיחות (כרטיס שלי = שיחה אישית)
  const ownStudentsPromise = user?.id
    ? getOwnStudents(supabase, user.id)
    : Promise.resolve({ students: [], failed: false });

  // כל הסקשנים בלתי תלויים זה בזה, ולכן נשלפים במקביל. כל שליפה מטפלת
  // בשגיאה שלה (רישום + ערך ריק), כך שתקלה בסקשן אחד לא מפילה את האחרים.
  const [
    favoritesResult,
    ownStudentsResult,
    activeShidduchimResult,
    activeShidduchimCountRaw,
    openProposalsResult,
    forumResult,
    chats,
    shadchanApplicationStatus,
    staffApplicationStatus,
    poolCounts,
  ] = await Promise.all([
    // מיועדים שעניינו אותך והוספת ללוח העבודה - מוצגים לשדכן ולמנהל בלבד
    isShadchanView
      ? getFavoriteStudents(supabase, favorites)
      : { students: [], failed: false },
    // הכרטיסים שבבעלות המשתמש
    ownStudentsPromise,
    // השידוכים שהשדכן המחובר הציע
    user?.id && isShadchanView
      ? getRecentShidduchim(supabase, user.id)
      : { shidduchim: [], failed: false },
    // המספר בכותרת הוא כלל ההצעות שנשלחו, ולא רק האחרונות שמוצגות
    user?.id && isShadchanView ? getSentShidduchimCount(supabase, user.id) : 0,
    // הצעות פתוחות שנשלחו למיועדים של המשתמש (כמנהל כרטיס) - החדשות קודם
    user?.id
      ? getMyProposals(supabase, {
          openOnly: true,
          limit: OPEN_PROPOSALS_LIMIT,
        })
      : { proposals: [], failed: false },
    // פוסטים אחרונים בפורום השדכנים
    isShadchanView
      ? getLatestForumPosts(supabase)
      : { posts: [], failed: false },
    // חדרי הצ'אט של המשתמש עם ההודעה האחרונה בכל חדר, מפוצלים לשיחות כשדכן
    // ולשיחות כבעל כרטיס (לשדכן/מנהל); למשתמש רגיל הכול באזור אחד
    user?.id
      ? loadChats(supabase, user.id, isShadchanView, ownStudentsPromise)
      : EMPTY_CHATS,
    // רק מי שנרשם כדי להיות שדכן ועדיין אינו שדכן צריך את סטטוס הבקשה
    user?.id && needsShadchanApplicationStatus
      ? getShadchanApplicationStatus(supabase, user.id)
      : null,
    // אותו עיקרון למי שנרשם כדי להיות איש צוות
    user?.id && needsStaffApplicationStatus
      ? getStaffApplicationStatus(supabase, user.id)
      : null,
    // גודל המאגר - לשדכן/מנהל בלבד; הורים לא רואים ספירות מאגר
    isShadchanView ? getPoolCounts(supabase) : null,
  ]);

  const ownCards = ownStudentsResult.students;
  const favoritesStudentsData = favoritesResult.students;
  const activeShidduchimData = activeShidduchimResult.shidduchim;
  const openProposals = openProposalsResult.proposals;

  // הדשבורד מציג תמצית: האחרונים בלבד, והכפתור בכל מקטע מוביל לעמוד המלא.
  // החדרים כבר ממוינים מהחדש לישן, והחיתוך נעשה אחרי הפיצול לאזורים
  const shadchanChats = chats.shadchan.slice(0, DASHBOARD_PREVIEW_LIMIT);
  const personalChats = chats.personal.slice(0, DASHBOARD_PREVIEW_LIMIT);
  const favoritesPreview = favoritesStudentsData.slice(
    0,
    DASHBOARD_PREVIEW_LIMIT,
  );

  // שדכן/מנהל בלי כרטיסים: האם יש בכלל שדכנים שפעלו בשבילו. רק אז נדרשת
  // השליפה, והיא מסתירה את המקטע רק כשחזרה רשימה ריקה (שגיאה - לא מסתירים)
  const hasNoShadchanim =
    isShadchanView && ownCards.length === 0 && !ownStudentsResult.failed
      ? (await getShadchanimWhoActedForMe(1))?.length === 0
      : false;

  const joinPrompt = shadchanJoinPrompt({
    signupPurpose,
    isShadchanOrAdmin: isShadchanView,
    applicationStatus: shadchanApplicationStatus,
  });

  const staffPrompt = staffJoinPrompt({
    signupPurpose,
    isStaffOrAdmin,
    applicationStatus: staffApplicationStatus,
  });

  // "המשך הרשמה": בקשת הצטרפות שעוד לא הוגשה, או הורה/מחפש בלי כרטיס
  const signupTarget = continueSignupTarget({
    signupPurpose,
    shadchanPrompt: joinPrompt,
    staffPrompt,
    ownCardsCount: ownStudentsResult.failed ? null : ownCards.length,
    isShadchanView,
    isStaff: isStaffOrAdmin,
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

      {/* כשיש "המשך הרשמה", הכרטיס הגדול מחליף את באנר ההצטרפות; "אחר כך"
          מקטין אותו חזרה לבאנר */}
      {shadchanAccess === "frozen" && !isAdmin && <ShadchanFrozenBanner />}
      {signupTarget && <ContinueSignupCta target={signupTarget} />}
      {joinPrompt === "pending" && <ShadchanJoinBanner prompt={joinPrompt} />}
      {staffPrompt === "pending" && (
        <ShadchanJoinBanner prompt={staffPrompt} track="staff" />
      )}

      {isShadchanView && (
        <ShadchanArea
          poolCounts={poolCounts}
          activeShidduchim={activeShidduchimData}
          activeShidduchimCount={activeShidduchimCount}
          activeShidduchimFailed={activeShidduchimResult.failed}
          favorites={favoritesPreview}
          favoritesFailed={favoritesResult.failed}
          chats={shadchanChats}
          chatsFailed={chats.failed}
          forumPosts={forumResult.posts}
          forumFailed={forumResult.failed}
        />
      )}

      {/* מקטעי הורה/בעל כרטיס – לכל משתמש מחובר (כולל כשהתפקיד לא מוגדר) */}
      {user && (
        <PersonalArea
          isInsideArea={isShadchanView}
          openProposals={openProposals}
          openProposalsFailed={openProposalsResult.failed}
          chats={personalChats}
          chatsFailed={chats.failed}
          ownCards={ownCards}
          ownCardsFailed={ownStudentsResult.failed}
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
