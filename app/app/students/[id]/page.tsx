import { Suspense } from "react";
import { unstable_noStore as noStore } from "next/cache";
import { after } from "next/server";

import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { describeSupabaseError } from "@/lib/supabase/describe-error";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser, hasRole } from "@/lib/user";
import { StudentCardActions } from "@/features/students/components/card/student-card-actions";
import { PublicStudentCard } from "@/features/students/components/card/public-student-card";
import { StudentCard } from "@/features/students/components/card/student-card";
import { StudentCardSkeleton } from "@/features/students/components/card/student-card-skeleton";
import {
  ANONYMOUS_BASIC_STUDENT_SELECT,
  ANONYMOUS_STUDENT_SELECT,
  BASIC_STUDENT_SELECT,
  FULL_STUDENT_SELECT,
  buildPublicStudent,
  parentsInfoFromNames,
  toAnonymousRowFromBasic,
  type AnonymousStudentRow,
} from "@/features/students/lib/student-card-data";
import { withoutFillReason } from "@/features/students/lib/author-info";
import { isDisplayRestricted } from "@/features/students/lib/third-party-card";
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
} from "@/features/students/lib/student-photo-access";
import { getStudentCardAccess } from "@/features/students/lib/student-card-access";
import {
  buildProposalStudentSelect,
  redactProposalStudent,
} from "@/features/students/lib/student-proposal-card";
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  student: any,
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
  const approval = await loadThirdPartyApproval(
    isAnonymous ? createAdminClient() : supabase,
    id,
  );
  const isBasicOnly =
    approval !== null &&
    isDisplayRestricted(approval, {
      isOwner: approval.user_id === user?.id,
      isAdmin,
    });

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
        body="אין לך הרשאה לצפות בכרטיס הזה, או שהוא אינו קיים במערכת"
      />
    );
  }

  // השורה ופידבק הצוות אינם תלויים זה בזה (מזהה הכרטיס כבר ידוע מהכתובת),
  // ולכן יוצאים יחד. הפידבק נצרך רק אחרי שהשורה עברה את כל הבדיקות למטה;
  // כרטיס שאינו זמין לצופה מחזיר הודעה, והפידבק שנשלף נזרק בלי להיחשף.
  const rowQuery = isAnonymous
    ? createAdminClient()
        .from("students")
        .select(
          isBasicOnly
            ? ANONYMOUS_BASIC_STUDENT_SELECT
            : ANONYMOUS_STUDENT_SELECT,
        )
        .eq("id", id)
        // אין RLS למשתמש anon (זה client עם service role) - הסינון על
        // deleted_at חייב לקרות כאן במפורש, אחרת כרטיס שנמחק "רך" יחשף.
        .is("deleted_at", null)
        .single()
    : supabase
        .from("students")
        .select(
          isBasicOnly
            ? BASIC_STUDENT_SELECT
            : isProposalView && access
              ? buildProposalStudentSelect(access)
              : FULL_STUDENT_SELECT,
        )
        .eq("id", id)
        .single();
  const [{ data, error }, staffFeedback] = await Promise.all([
    rowQuery,
    loadStaffFeedback(supabase, id),
  ]);

  if (error) {
    // הודעת Postgres נשארת בשרת: גולש אנונימי אינו אמור לראות שמות
    // טבלאות ועמודות
    console.error(
      "[students/card] load failed",
      id,
      describeSupabaseError(error),
    );
    return (
      <CardNotice
        tone="error"
        title="שגיאה בטעינת הפרופיל"
        body="לא ניתן לטעון את הכרטיס כרגע. נסו שוב בעוד מספר רגעים"
      />
    );
  }

  // חיתוך פרטי ההתקשרות שחבויים בעמודות ה-JSON. חייב לקרות כאן, לפני
  // שהשורה מגיעה לרינדור.
  //
  // השורה רופפת בכוונה, כמו StudentRow ב-student-card.tsx: ה-select נבנה
  // בזמן ריצה לפי רמת הגישה, ולכן PostgREST אינו יכול להסיק ממנו טיפוס.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shapedRow: any =
    isBasicOnly && data && !isAnonymous
      ? parentsInfoFromNames(data as never)
      : data;
  // ההסבר "מדוע מילאתי" מוצג למנהלים ולממלא בלבד
  const canSeeFillReason =
    isAdmin || Boolean(shapedRow?.user_id && shapedRow.user_id === user?.id);
  const unreasonedRow: any =
    shapedRow && !canSeeFillReason && shapedRow.author_info
      ? { ...shapedRow, author_info: withoutFillReason(shapedRow.author_info) }
      : shapedRow;
  const student: any =
    isProposalView && access && unreasonedRow
      ? redactProposalStudent(unreasonedRow as Record<string, unknown>, access)
      : unreasonedRow;
  if (!student) {
    return (
      <CardNotice
        title="מיועד לא נמצא"
        body="הרשומה שחיפשת אינה קיימת במערכת"
      />
    );
  }

  // רישום צפייה של שדכן בכרטיס ("שדכנים שפעלו בשבילך" בלוח ההורה).
  // הקריאה יוצאת עכשיו (כל עוד ה-cookies של הבקשה זמינים) ו-after() רק
  // מבטיח שהיא תסתיים גם אחרי שהעמוד נשלח - הרינדור לא ממתין לה.
  if (user && hasRole(user, "shadchan") && student.user_id !== user.id) {
    after(recordStudentCardView(supabase, student.id));
  }

  // פידבק אנשי צוות (staffFeedback, נשלף למעלה) גלוי לכל צופה בכרטיס -
  // גם בענף הציבורי (קישור השיתוף)

  // --- ענף ציבורי (משתמש לא מחובר) --------------------------------------
  if (isAnonymous) {
    const publicStudent = buildPublicStudent(
      isBasicOnly
        ? toAnonymousRowFromBasic(student)
        : (student as AnonymousStudentRow),
    );

    // כלל מוחלט: אצל בת לעולם לא מוצגת תמונה בדף הציבורי - הגלריה נטענת
    // ונחתמת רק לבן, ולבת לא נוצר אף קישור.
    const publicPhotos =
      publicStudent.gender === "male"
        ? (await loadStudentPhotos(student.id, { canView: true })).photos
        : [];

    return (
      <PublicStudentCard
        studentId={student.id}
        student={publicStudent}
        photos={publicPhotos}
        staffFeedback={staffFeedback}
        thirdParty={approval ?? undefined}
        isBasicOnly={isBasicOnly}
      />
    );
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
  const [{ photoPrivate, studentPhotos }, shadchanNotes, owner] =
    await Promise.all([
      loadViewerPhotos(supabase, user, student, isProposalView),
      isShadchan
        ? loadMyShadchanNotes(supabase, student.id, user.id)
        : Promise.resolve([]),
      isAdmin && !isProposalView && student.user_id
        ? loadCardOwnerInfo(student.user_id)
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
    !isBasicOnly && (student.user_id === user?.id || isShadchan || isAdmin);
  const approvingAdminNames =
    isAdmin && approval?.card_for === "other"
      ? await Promise.all([
          loadAdminDisplayName(approval.third_party_full_display_approved_by),
          loadAdminDisplayName(approval.third_party_proposals_approved_by),
        ])
      : null;

  return (
    <StudentCard
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
      isBasicOnly={isBasicOnly}
      adminControls={
        approval && approvingAdminNames ? (
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
        ) : null
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
          personalStatus={student.personal_status}
          gender={student.gender}
          inShidduchim={student.in_shidduchim}
          canEdit={canEdit}
          canManage={isShadchan}
          canDelete={isAdmin}
          ownerUserId={owner?.userId ?? null}
        />
      }
    />
  );
}
