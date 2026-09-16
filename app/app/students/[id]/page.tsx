import { Suspense } from "react";
import { unstable_noStore as noStore } from "next/cache";
import { after } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasRole } from "@/lib/user";
import { StudentCardActions } from "@/features/students/components/card/student-card-actions";
import { PublicStudentCard } from "@/features/students/components/card/public-student-card";
import { StudentCard } from "@/features/students/components/card/student-card";
import { StudentCardSkeleton } from "@/features/students/components/card/student-card-skeleton";
import {
  ANONYMOUS_STUDENT_SELECT,
  FULL_STUDENT_SELECT,
  buildPublicStudent,
  type AnonymousStudentRow,
} from "@/features/students/lib/student-card-data";
import {
  loadMyShadchanNotes,
  loadStaffFeedback,
} from "@/features/students/lib/student-notes-data";
import { loadStudentPhotos } from "@/features/students/lib/student-photos";
import { canViewStudentPhoto } from "@/features/students/lib/student-photo-access";
import { recordStudentCardView } from "@/features/students/lib/record-card-view";

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
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // חייב להיקבע לפני שליפת המידע - קובע אילו עמודות/embeds מותר בכלל
  // לשלוף (ראה ההערה על AnonymousStudentRow ב-student-card-data.ts). זה לא
  // רק "מה מוצג ב-JSX": Server Component מסדרר (serialize) כל מה שנשלף
  // להטבעה ב-HTML, ולכן הגבלת מידע חייבת לקרות כבר ברמת ה-query.
  const isAnonymous = !user;

  const { data, error } = isAnonymous
    ? await createAdminClient()
        .from("students")
        .select(ANONYMOUS_STUDENT_SELECT)
        .eq("id", id)
        // אין RLS למשתמש anon (זה client עם service role) - הסינון על
        // deleted_at חייב לקרות כאן במפורש, אחרת כרטיס שנמחק "רך" יחשף.
        .is("deleted_at", null)
        .single()
    : await supabase
        .from("students")
        .select(FULL_STUDENT_SELECT)
        .eq("id", id)
        .single();

  const isShadchan = hasRole(user, "shadchan") || hasRole(user, "admin");
  const isAdmin = hasRole(user, "admin");

  if (error) {
    return (
      <CardNotice
        tone="error"
        title="שגיאה בטעינת הפרופיל"
        body={error.message}
      />
    );
  }

  const student = data;
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

  // פידבק אנשי צוות גלוי לכל צופה בכרטיס - גם בענף הציבורי (קישור השיתוף)
  const staffFeedback = await loadStaffFeedback(supabase, student.id);

  // --- ענף ציבורי (משתמש לא מחובר) --------------------------------------
  if (isAnonymous) {
    const publicStudent = buildPublicStudent(student as AnonymousStudentRow);

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
      />
    );
  }

  // תמונה של בת נחשפת למנהל, לבעל הכרטיס, ולשדכן שקיבל אישור צפייה
  // מפורש. ההכרעה נעשית ב-can_view_student_photo ולא כאן, כדי שאותו
  // כלל יחול גם על כל קורא אחר של הטבלה.
  // (אותה בדיקה משמשת את התמונות הממוזערות בטבלת המיועדים)
  const photoPrivate = !(await canViewStudentPhoto(
    supabase,
    user?.id ?? null,
    student,
  ));
  // בלי הרשאה נטען רק מספר התמונות (למנעול) - אף קישור חתום לא נוצר
  const studentPhotos = await loadStudentPhotos(student.id, {
    canView: !photoPrivate,
  });

  // הערות שדכן פרטיות לכותב (RLS); פידבק אנשי צוות נשלף למעלה לכל צופה.
  // איש צוות רשאי לכתוב פידבק - שיוכו למוסד של המיועד נאכף ב-RLS.
  const canWriteStaffFeedback = hasRole(user, "staff");
  const shadchanNotes =
    isShadchan && user
      ? await loadMyShadchanNotes(supabase, student.id, user.id)
      : [];
  const currentUserName = [
    user?.user_metadata?.firstName,
    user?.user_metadata?.lastName,
  ]
    .filter(Boolean)
    .join(" ");

  // חייב לשקף בדיוק את ההרשאה של update_full_student_profile (בעלים / שדכן /
  // מנהל), אחרת כפתור "עריכה" יוביל למסך שהשמירה בו תיפול על not_allowed.
  const canEdit = student.user_id === user?.id || isShadchan || isAdmin;

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
      actions={
        // ההרשאות נקבעות כאן, בשרת, ונמסרות כדגלים: קו״ח רק כשקיים, עריכה
        // לבעלים/שדכן/מנהל, שיתוף לכל מי שרואה את הכרטיס, פנייה ועדכון
        // סטטוס לשדכן/מנהל, ומחיקה למנהל בלבד.
        <StudentCardActions
          studentId={student.id}
          studentName={`${student.first_name} ${student.last_name}`}
          authorId={student.user_id}
          cvUrl={student.cv_url ?? null}
          personalStatus={student.personal_status}
          gender={student.gender}
          canEdit={canEdit}
          canManage={isShadchan}
          canDelete={isAdmin}
        />
      }
    />
  );
}
