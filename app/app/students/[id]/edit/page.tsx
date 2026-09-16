import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { Suspense } from "react";

import { Box, PageTitle } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/user";
import {
  existingMedicalDocuments,
  studentToFormValues,
  type StudentRowWithRelations,
} from "@/features/students/lib/student-to-form";
import { loadStudentPhotos } from "@/features/students/lib/student-photos";
import type { StudentPhotoItem } from "@/features/students/lib/student-photo-rules";
import EditStudentForm from "./edit-student-form";

// אין כאן export const dynamic — הוא אסור תחת Cache Components (ראה ההערה
// בדף הכרטיס). noStore מספיק כדי שהטופס ייטען תמיד מהמצב העדכני.

function EditNotice({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="space-y-3 text-center">
        <p className="font-semibold text-foreground">{title}</p>
        <p className="text-body-sm text-muted-foreground">{body}</p>
        <Button asChild variant="outline">
          <Link href="/app/students">חזרה לרשימה</Link>
        </Button>
      </div>
    </div>
  );
}

// --- שלד טעינה -----------------------------------------------------------
// מחקה את מבנה אשף הקו״ח (features/students/lib/student-form-wizard.tsx):
// אותה מעטפת Box, אותה רשת [200px|1fr] מ-lg, ניווט שלבים (פס עליון מתחת
// ל-lg), שדות וכפתורי ניווט - כדי שהמעבר מהשלד לטופס האמיתי לא יזיז כלום.
// הכותרת זהה לזו של EditStudentForm ולכן נשארת סטטית גם בשלד.
const SKELETON_STEP_COUNT = 7;
const SKELETON_FIELD_COUNT = 6;

function EditStudentFormSkeleton() {
  return (
    <SkeletonRegion className="my-2 space-y-4 md:my-6 md:space-y-6">
      <PageTitle>עריכת קו״ח</PageTitle>
      <Box className="px-4 pt-5 pb-0 max-md:-mx-3 max-md:rounded-none md:px-6 md:pt-6">
        <div className="grid gap-5 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-6">
          <div className="flex items-center justify-between gap-2 lg:hidden">
            {Array.from({ length: SKELETON_STEP_COUNT }, (_, index) => (
              <Skeleton key={index} className="size-9 rounded-full" />
            ))}
          </div>
          <div className="hidden space-y-1 lg:block">
            {Array.from({ length: SKELETON_STEP_COUNT }, (_, index) => (
              <Skeleton key={index} className="h-11 w-full rounded-lg" />
            ))}
          </div>
          <div className="min-w-0">
            <Skeleton className="h-8 w-48" />
            <div className="mt-6 grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2">
              {Array.from({ length: SKELETON_FIELD_COUNT }, (_, index) => (
                <div key={index} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
            <div className="mt-8 flex items-center justify-between gap-3 border-t py-4">
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-10 w-36" />
            </div>
          </div>
        </div>
      </Box>
      <span className="sr-only">טוען את טופס עריכת הקו״ח…</span>
    </SkeletonRegion>
  );
}

export default function EditStudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<EditStudentFormSkeleton />}>
      <EditStudentPageContent params={params} />
    </Suspense>
  );
}

// קריאת ה-session, שליפת הכרטיס ובדיקת ההרשאה נשארו כפי שהיו - הן רק ירדו
// אל מתחת ל-Suspense.
async function EditStudentPageContent({
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

  if (!user) {
    return (
      <EditNotice
        title="נדרשת התחברות"
        body="כדי לערוך כרטיס יש להתחבר למערכת."
      />
    );
  }

  const { data, error } = await supabase
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
    .eq("id", id)
    .single();

  if (error || !data) {
    return (
      <EditNotice
        title="מיועד לא נמצא"
        body={error?.message ?? "הרשומה שחיפשת אינה קיימת במערכת"}
      />
    );
  }

  const student = data as StudentRowWithRelations;

  // בדיוק אותה הרשאה שה-RPC אוכף (בעלים / שדכן / מנהל), כדי שמסך שנפתח
  // לעולם לא ייפול על not_allowed בשמירה.
  const canEdit =
    student.user_id === user.id ||
    hasRole(user, "shadchan") ||
    hasRole(user, "admin");

  if (!canEdit) {
    return (
      <EditNotice
        title="אין לך הרשאה לערוך כרטיס זה"
        body="עריכת כרטיס פתוחה לבעל הכרטיס, לשדכנים ולמנהלים בלבד."
      />
    );
  }

  const photos = await loadEditablePhotos(supabase, {
    userId: user.id,
    studentId: id,
    gender: student.gender,
  });

  return (
    <EditStudentForm
      studentId={id}
      initialValues={{ ...studentToFormValues(student), photos }}
      existingCvUrl={typeof student.cv_url === "string" ? student.cv_url : null}
      existingMedicalDocuments={existingMedicalDocuments(student)}
      isCardOwner={student.user_id === user.id}
    />
  );
}

/**
 * הגלריה לעריכה, לפי אותו כלל כמו בדף הכרטיס: תמונה של בת נחשפת רק למי
 * ש-can_view_student_photo מאשר. תמונה שאין הרשאה לראות מגיעה בלי קישור -
 * הטופס מציג אותה נעולה ושומר אותה במקומה.
 */
async function loadEditablePhotos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  {
    userId,
    studentId,
    gender,
  }: { userId: string; studentId: string; gender: unknown },
): Promise<StudentPhotoItem[]> {
  const { data: canViewFemalePhoto } = await supabase.rpc(
    "can_view_student_photo",
    { uid: userId, sid: studentId },
  );
  const photoPrivate = gender === "female" && !canViewFemalePhoto;
  const { paths, photos } = await loadStudentPhotos(studentId, {
    canView: !photoPrivate,
  });
  const urlByPath = new Map(photos.map((photo) => [photo.path, photo.url]));

  // לעורך שאינו רשאי לראות לא נשלח אפילו הנתיב - רק כמות התמונות הנעולות
  return paths.map((path) => ({
    kind: "existing",
    path: photoPrivate ? "" : path,
    url: urlByPath.get(path) ?? null,
  }));
}
