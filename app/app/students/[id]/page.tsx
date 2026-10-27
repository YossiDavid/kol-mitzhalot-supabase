import { CardProposalsSection } from "@/features/students/components/card/card-proposals-section";
import { loadCardProposals } from "@/features/students/lib/card-proposals";
import { Suspense } from "react";
import { unstable_noStore as noStore } from "next/cache";
import { after } from "next/server";

import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser, hasRole } from "@/lib/user";
import { StudentCardActions } from "@/features/students/components/card/student-card-actions";
import { PublicStudentCard } from "@/features/students/components/card/public-student-card";
import { StudentCard } from "@/features/students/components/card/student-card";
import { StudentCardSkeleton } from "@/features/students/components/card/student-card-skeleton";
import { buildPublicStudent } from "@/features/students/lib/student-card-data";
import { loadStudentCard } from "@/features/students/lib/load-student-card";
import { shapeStudentCard } from "@/features/students/lib/shape-student-card";
import {
  STUDENT_CARDS_VIEW,
  isDisplayRestricted,
} from "@/features/students/lib/third-party-card";
import { AdminPausedBanner } from "@/features/students/components/card/admin-paused-banner";
import { MatchmakingHoldPanel } from "@/features/students/components/card/matchmaking-hold-panel";
import { SiblingsSection } from "@/features/students/components/card/siblings-section";
import { loadCardSiblings } from "@/features/students/lib/card-siblings";
import { loadMatchmakingHold } from "@/features/students/lib/card-matchmaking-hold";
import { loadCardAdminPaused } from "@/features/students/lib/card-admin-pause";
import { maskSilentPauseForOwner } from "@/features/students/lib/card-silent-pause";
import { loadCardAdminFocus } from "@/features/students/lib/card-admin-focus";
import { loadThirdPartyApproval } from "@/features/students/lib/third-party-approval";
import { ThirdPartyApprovalControls } from "@/features/admin/components/third-party-approval-controls";
import {
  loadMyShadchanNotes,
  loadStaffFeedback,
} from "@/features/students/lib/student-notes-data";
import { loadStudentPhotos } from "@/features/students/lib/student-photos";
import {
  canViewStudentPhoto,
  isGroomPhotoWithheld,
  type PhotoAccessSubject,
} from "@/features/students/lib/student-photo-access";
import { toPersonalStatus } from "@/features/students/lib/student-status";
import { getCardBackLink } from "@/features/students/lib/card-back-link";
import { getStudentCardAccess } from "@/features/students/lib/student-card-access";
import {
  cardApprovalStatus,
  isCardApproved,
} from "@/features/students/lib/card-approval";
import { CardApprovalBanner } from "@/features/students/components/card/card-approval-banner";
import { CardApprovalControls } from "@/features/admin/components/card-approval-controls";
import { recordStudentCardView } from "@/features/students/lib/record-card-view";
import {
  loadAdminDisplayName,
  loadCardOwnerInfo,
} from "@/features/students/lib/card-owner";

// הערה: אין כאן export const dynamic — הוא אסור תחת Cache Components
// (next.config: cacheComponents) והבנייה נכשלת עליו. גם אין בו צורך:
// ללא "use cache" שום דבר אינו נשמר בקאש המשותף, ותוכן שתלוי ב-cookies
// או headers הוא session-specific ממילא.

function CardNotice({
  title,
  body,
  tone,
}: {
  title: string;
  body: string;
  tone?: "error";
}) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="space-y-2 text-center">
        <p
          className={
            tone === "error"
              ? "font-semibold text-destructive"
              : "font-semibold text-foreground"
          }
        >
          {title}
        </p>
        <p className="text-body-sm text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

/**
 * מצב התמונות של הצופה המחובר בכרטיס. הסדר בתוך הפונקציה נשמר בכוונה:
 * ההסתרה לצד הכלה והרשאת הצפייה נקבעות *לפני* שמישהו קורא את התמונות.
 */
async function loadViewerPhotos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: User,
  student: PhotoAccessSubject,
  isProposalView: boolean,
) {
  // בחור שנחשף לצד הכלה דרך הצעה ששדכן סימן בה "בלי תמונה": אין תמונות
  // כלל - לא גלריה ולא מונה למנעול. image_url (האווטאר בכותרת) אינו נשלף
  // בתצוגת הצעה בשום מצב (ראו student-proposal-card.ts ובדיקתו). ההכרעה
  // נעשית פה, בשרת, לפני שהשורה מגיעה לרינדור.
  const isGroomPhotoHidden =
    isProposalView && student.gender === "male"
      ? await isGroomPhotoWithheld(supabase, student.id)
      : false;

  // תמונה של בת נחשפת למנהל, לבעל הכרטיס, ולשדכן שקיבל אישור צפייה
  // מפורש. ההכרעה נעשית ב-can_view_student_photo ולא כאן, כדי שאותו
  // כלל יחול גם על כל קורא אחר של הטבלה.
  // (אותה בדיקה משמשת את התמונות הממוזערות בטבלת המיועדים)
  const photoPrivate =
    !isGroomPhotoHidden &&
    !(await canViewStudentPhoto(supabase, user.id, student));
  // בלי הרשאה נטען רק מספר התמונות (למנעול) - אף קישור חתום לא נוצר.
  // בחור שהתמונות שלו הוסתרו לא נקרא מהמסד בכלל.
  const studentPhotos = isGroomPhotoHidden
    ? { count: 0, paths: [], photos: [] }
    : await loadStudentPhotos(student.id, { canView: !photoPrivate });
  return { photoPrivate, studentPhotos };
}

export default function StudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<StudentCardSkeleton />}>
      <StudentPageContent params={params} />
    </Suspense>
  );
}

// הקומפוננטה שקוראת את ה-session ומחליטה מה נחשף (כולל הענף הציבורי לגולש
// לא מחובר). היא יושבת מתחת ל-Suspense.
async function StudentPageContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  noStore();
  const { id } = await params;
  // getUser הממוזכר (lib/user) - המעטפת כבר קראה אותו באותה בקשה, ולכן אין
  // כאן עוד פנייה לשרת האימות. ה-client נוצר במקביל.
  const [supabase, user] = await Promise.all([createClient(), getUser()]);

  // חייב להיקבע לפני שליפת המידע - קובע אילו עמודות/embeds מותר בכלל
  // לשלוף (ראה ההערה על AnonymousStudentRow ב-student-card-data.ts). זה לא
  // רק "מה מוצג ב-JSX": Server Component מסדרר (serialize) כל מה שנשלף
  // להטבעה ב-HTML, ולכן הגבלת מידע חייבת לקרות כבר ברמת ה-query.
  const isAnonymous = !user;
  const isAdmin = hasRole(user, "admin");
  const isShadchan = hasRole(user, "shadchan") || isAdmin;

  // כרטיס צד שלישי שלא אושר להצגה מלאה: הצופה (חוץ מבעל הכרטיס ומנהל) מקבל
  // select בסיסי בלבד, ולכן שאר הנתונים לא נשלפים ולא מגיעים ללקוח כלל.
  // נקבע לפני השליפה, כמו רמת הגישה.
  const approval = isAnonymous
    ? await loadThirdPartyApproval(createAdminClient(), id, "students")
    : await loadThirdPartyApproval(supabase, id, STUDENT_CARDS_VIEW);
  const isBasicOnly =
    approval !== null &&
    isDisplayRestricted(approval, {
      isOwner: approval.user_id === user?.id,
      isAdmin,
    });

  // כרטיס שהנהלת המערכת עוד לא אישרה (ממתין או נדחה) גלוי לבעליו ולמנהלים
  // בלבד. למשתמש מחובר זה נאכף במסד (רמת הגישה למטה חוזרת "none"); קישור
  // השיתוף הציבורי נקרא ב-service role, ולכן נעצר כאן, לפני כל שליפה.
  if (isAnonymous && approval && !isCardApproved(approval)) {
    return (
      <CardNotice
        title="הכרטיס אינו זמין"
        body="ייתכן שהכרטיס עדיין ממתין לאישור, שאין לך הרשאה לצפות בו, או שהקישור שגוי"
      />
    );
  }
  const approvalStatus = approval ? cardApprovalStatus(approval) : "approved";

  // רמת הגישה נקבעת לפני השליפה, כי היא בוחרת את ה-select. מנהל כרטיס
  // שקיבל הצעת שידוך מקבל "proposal": הכרטיס במלואו, בלי פרטי התקשרות
  // ובלי הצהרה רפואית - אלא אם השדכן פתח אותם להצעה הזו.
  const access = isAnonymous ? null : await getStudentCardAccess(supabase, id);
  const isProposalView = access?.level === "proposal";

  // "אין גישה" זהה למה שה-RLS היה חוסם, ולכן עוצרים כאן עם הודעה במקום
  // לשלוח שאילתה שתיכשל ותציג למשתמש הודעת שגיאה של Postgres.
  if (access?.level === "none") {
    return (
      <CardNotice
        title="הכרטיס אינו זמין"
        body="ייתכן שהכרטיס עדיין ממתין לאישור, שאין לך הרשאה לצפות בו, או שהקישור שגוי"
      />
    );
  }

  // השורה ופידבק הצוות אינם תלויים זה בזה (מזהה הכרטיס כבר ידוע מהכתובת),
  // ולכן יוצאים יחד. הפידבק נצרך רק אחרי שהשורה עברה את כל הבדיקות למטה;
  // כרטיס שאינו זמין לצופה מחזיר הודעה, והפידבק שנשלף נזרק בלי להיחשף.
  // הווריאנט נבחר ומאומת ב-loadStudentCard (select + schema + טיפוס).
  const [loaded, staffFeedback] = await Promise.all([
    loadStudentCard({
      supabase,
      studentId: id,
      isAnonymous,
      isBasicOnly,
      proposal: isProposalView && access ? access : null,
    }),
    loadStaffFeedback(supabase, id),
  ]);

  if (loaded.status === "error") {
    // הפירוט נשאר בשרת: גולש אנונימי אינו אמור לראות שמות טבלאות ועמודות
    console.error("[students/card] load failed", id, loaded.detail);
    return (
      <CardNotice
        tone="error"
        title="שגיאה בטעינת הפרופיל"
        body="לא ניתן לטעון את הכרטיס כרגע. נסו שוב בעוד מספר רגעים"
      />
    );
  }
  if (loaded.status === "missing") {
    return (
      <CardNotice
        title="מיועד לא נמצא"
        body="הרשומה שחיפשת אינה קיימת במערכת"
      />
    );
  }

  // חיתוך פרטי ההתקשרות שחבויים בעמודות ה-JSON וההסבר "מדוע מילאתי" (למנהלים
  // ולממלא בלבד). חייב לקרות כאן, לפני שהשורה מגיעה לרינדור.
  const shaped = shapeStudentCard(loaded.card, {
    userId: user?.id ?? null,
    isAdmin,
  });

  // מחמאות צוות (staffFeedback, נשלף למעלה) גלויות לכל צופה בכרטיס -
  // גם בענף הציבורי (קישור השיתוף)

  // --- ענף ציבורי (משתמש לא מחובר) --------------------------------------
  if (shaped.audience === "anonymous") {
    const publicStudent = buildPublicStudent(shaped.student);

    // כלל מוחלט: אצל בת לעולם לא מוצגת תמונה בדף הציבורי - הגלריה נטענת
    // ונחתמת רק לבן, ולבת לא נוצר אף קישור.
    const publicPhotos =
      publicStudent.gender === "male"
        ? (await loadStudentPhotos(publicStudent.id, { canView: true })).photos
        : [];

    return (
      <PublicStudentCard
        studentId={publicStudent.id}
        student={publicStudent}
        photos={publicPhotos}
        staffFeedback={staffFeedback}
        thirdParty={approval ?? undefined}
        isBasicOnly={isBasicOnly}
      />
    );
  }
  // השהיה שקטה של ההנהלה: מנהל הכרטיס (שאינו מנהל מערכת) רואה אותו כפעיל
  const isOwnerViewer =
    !!user && shaped.student.user_id === user.id && !isAdmin;
  const student = isOwnerViewer
    ? (await maskSilentPauseForOwner([shaped.student]))[0]
    : shaped.student;
  if (!user) {
    // ענף מחובר קיים רק למשתמש מחובר; אנונימי טופל למעלה
    return (
      <CardNotice
        title="הכרטיס אינו זמין"
        body="ייתכן שהכרטיס עדיין ממתין לאישור, שאין לך הרשאה לצפות בו, או שהקישור שגוי"
      />
    );
  }

  // מי שצופה דרך הצעה אינו קורא את שורת students (גם לא את האישורים שלמעלה),
  // ולכן אצלו ההגבלה נקבעת מהשורה שהמסד החזיר - שכבר מכילה נתונים בסיסיים בלבד.
  const isBasicView =
    isBasicOnly ||
    (isProposalView &&
      isDisplayRestricted(student, { isOwner: false, isAdmin }));

  // רישום צפייה של שדכן בכרטיס ("שדכנים שפעלו בשבילך" בלוח ההורה).
  // הקריאה יוצאת עכשיו (כל עוד ה-cookies של הבקשה זמינים) ו-after() רק
  // מבטיח שהיא תסתיים גם אחרי שהעמוד נשלח - הרינדור לא ממתין לה.
  if (user && hasRole(user, "shadchan") && student.user_id !== user.id) {
    after(recordStudentCardView(supabase, student.id));
  }

  // התמונות, הערות השדכן ופרטי מנהל הכרטיס אינם תלויים זה בזה (כולם
  // תלויים רק בשורה ובהרשאות שכבר נקבעו), ולכן נטענים יחד. בתוך התמונות
  // הסדר נשמר: ההסתרה והרשאת הצפייה נקבעות לפני טעינת התמונות.
  //
  // הערות שדכן פרטיות לכותב (RLS); פידבק אנשי צוות נשלף למעלה לכל צופה.
  // איש צוות רשאי לכתוב פידבק - שיוכו למוסד של המיועד נאכף ב-RLS. מי
  // שרואה את הכרטיס רק בזכות הצעת שידוך אינו כותב עליו, גם אם הוא איש
  // צוות במוסד אחר - הכתיבה הייתה נכשלת ב-RLS ורק מציגה לו שגיאה.
  const canWriteStaffFeedback = hasRole(user, "staff") && !isProposalView;
  // פרטי מנהל הכרטיס (אימייל + קישור) נשלפים רק למנהל מערכת, ורק בכרטיס
  // המלא - לא בענף הציבורי ולא בתצוגת הצעה, ולכן לא מגיעים אליהם גם כ-props.
  const [
    { photoPrivate, studentPhotos },
    shadchanNotes,
    owner,
    isAdminPaused,
    cardProposals,
    adminFocus,
  ] = await Promise.all([
    loadViewerPhotos(supabase, user, student, isProposalView),
    isShadchan
      ? loadMyShadchanNotes(supabase, student.id, user.id)
      : Promise.resolve([]),
    isAdmin && !isProposalView && student.user_id
      ? loadCardOwnerInfo(student.user_id)
      : Promise.resolve(null),
    // מצב ההשהיה ע"י ההנהלה: נשלף למנהל מערכת בלבד, בנפרד מרשימות העמודות
    isAdmin ? loadCardAdminPaused(student.id) : Promise.resolve(null),
    // כמה הצעות הוצעו לכרטיס: בעלים, שדכן ומנהל, בכרטיס המלא בלבד. המסד
    // מחזיר null לכל אחר (ולכרטיס בסיסי / צופה דרך הצעה)
    !isProposalView && !isBasicView
      ? loadCardProposals(supabase, student.id, {
          userId: user.id,
          isAdmin,
          isShadchan,
        })
      : Promise.resolve(null),
    // סימון "במיקוד" של ההנהלה: לשדכן ולמנהל (ה-view מחזיר null לכל אחר)
    isShadchan && !isProposalView
      ? loadCardAdminFocus(supabase, student.id)
      : Promise.resolve(null),
  ]);
  const currentUserName = [
    user?.user_metadata?.firstName,
    user?.user_metadata?.lastName,
  ]
    .filter(Boolean)
    .join(" ");

  // חייב לשקף בדיוק את ההרשאה של update_full_student_profile (בעלים / שדכן /
  // מנהל), אחרת כפתור "עריכה" יוביל למסך שהשמירה בו תיפול על not_allowed.
  // כרטיס צד שלישי שלא אושר: שדכן שאינו הממלא אינו רואה את הכרטיס המלא, ולכן
  // גם לא עורך אותו (מסך העריכה מציג את כל הנתונים)
  const canEdit =
    !isBasicView && (student.user_id === user?.id || isShadchan || isAdmin);
  // "בתהליך שידוך": גלוי לבעלים, לשדכן ולמנהל (ה-RPC מחזיר null לכל אחר)
  const matchmakingHold = isProposalView
    ? null
    : await loadMatchmakingHold(supabase, student.id);
  const canManageHold =
    !isProposalView && (student.user_id === user.id || isAdmin);
  // אחים במערכת: לשדכן, למנהל ולבעלים, בכרטיס המלא בלבד
  const siblings =
    !isProposalView &&
    !isBasicView &&
    (isShadchan || isAdmin || student.user_id === user.id)
      ? await loadCardSiblings(student, { isAdmin })
      : [];
  const approvingAdminNames =
    isAdmin && approval?.card_for === "other"
      ? await Promise.all([
          loadAdminDisplayName(approval.third_party_full_display_approved_by),
          loadAdminDisplayName(approval.third_party_proposals_approved_by),
        ])
      : null;

  return (
    <StudentCard
      backLink={getCardBackLink(user)}
      student={student}
      photos={studentPhotos.photos}
      photoCount={studentPhotos.count}
      photoPrivate={photoPrivate}
      staffFeedback={staffFeedback}
      canWriteStaffFeedback={canWriteStaffFeedback}
      currentUserName={currentUserName}
      isShadchan={isShadchan}
      shadchanNotes={shadchanNotes}
      isProposalView={isProposalView}
      showMedical={!isProposalView || !!access?.shareMedical}
      owner={owner}
      isBasicOnly={isBasicView}
      adminFocus={adminFocus}
      adminControls={
        <>
          {(approvalStatus === "pending" || approvalStatus === "rejected") &&
            !isAdmin &&
            student.user_id === user.id && (
              <CardApprovalBanner
                studentId={student.id}
                status={approvalStatus}
                rejectionReason={approval?.admin_rejection_reason ?? null}
              />
            )}
          {isAdmin && approval && !isProposalView && (
            <CardApprovalControls
              studentId={student.id}
              studentName={`${student.first_name} ${student.last_name}`}
              status={approvalStatus}
              rejectionReason={approval.admin_rejection_reason}
              returnToQueue
              isPaused={isAdminPaused === true}
            />
          )}
          {isAdminPaused === true && <AdminPausedBanner />}
          <MatchmakingHoldPanel
            studentId={student.id}
            hold={matchmakingHold}
            canManage={canManageHold}
          />
          <SiblingsSection siblings={siblings} />
          {cardProposals && (
            <CardProposalsSection
              studentId={student.id}
              proposals={cardProposals}
            />
          )}
          {approval && approvingAdminNames ? (
            <ThirdPartyApprovalControls
              studentId={student.id}
              fullDisplay={{
                approvedAt: approval.third_party_full_display_approved_at,
                approvedByName: approvingAdminNames[0],
              }}
              proposals={{
                approvedAt: approval.third_party_proposals_approved_at,
                approvedByName: approvingAdminNames[1],
              }}
            />
          ) : null}
        </>
      }
      actions={
        // ההרשאות נקבעות כאן, בשרת, ונמסרות כדגלים: קו״ח רק כשקיים, עריכה
        // לבעלים/שדכן/מנהל, שיתוף לכל מי שרואה את הכרטיס, פנייה ועדכון
        // סטטוס לשדכן/מנהל, ומחיקה למנהל בלבד.
        <StudentCardActions
          studentId={student.id}
          studentName={`${student.first_name} ${student.last_name}`}
          // כרטיס שלי: אין עם מי לפתוח צ'אט
          authorId={
            student.user_id && student.user_id !== user?.id
              ? student.user_id
              : null
          }
          cvUrl={student.cv_url ?? null}
          personalStatus={toPersonalStatus(student.personal_status)}
          gender={student.gender ?? null}
          inShidduchim={student.in_shidduchim}
          isPubliclyVisible={approvalStatus === "approved"}
          canEdit={canEdit}
          canManage={isShadchan}
          canDelete={isAdmin}
          ownerUserId={owner?.userId ?? null}
          // דיווח: כל מחובר שרואה את הכרטיס ואינו בעליו. ההכרעה האמיתית
          // נעשית שוב בשרת, ב-report_student_card
          canReport={student.user_id !== user.id}
          adminPause={
            isAdminPaused === null ? null : { isPaused: isAdminPaused }
          }
          adminFocus={isAdmin ? adminFocus : null}
        />
      }
    />
  );
}
