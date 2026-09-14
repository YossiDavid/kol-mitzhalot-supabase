import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { Suspense } from "react";

import { Box, Section } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/user";
import {
  existingMedicalDocuments,
  studentToFormValues,
  type StudentRowWithRelations,
} from "@/features/students/lib/student-to-form";
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
// אותה מעטפת Section/Box, אותה רשת [220px|1fr], סרגל שלבים, שדות וכפתורי
// ניווט - כדי שהמעבר מהשלד לטופס האמיתי לא יזיז כלום. הכותרת זהה לזו של
// EditStudentForm ולכן נשארת סטטית גם בשלד. כל המידות קבועות.
const SKELETON_STEP_COUNT = 8;
const SKELETON_FIELD_COUNT = 6;

function EditStudentFormSkeleton() {
  return (
    <Section asChild className="my-4 space-y-4 md:my-10">
      <div role="status" aria-label="טוען">
        <h1 className="mb-4 text-heading font-bold md:text-heading">
          עריכת קו״ח
        </h1>
        <Box className="p-4 md:p-8">
          <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)] md:gap-8">
            <nav className="flex gap-1 overflow-x-auto pb-2 md:block md:space-y-2 md:overflow-x-visible md:pb-0">
              {Array.from({ length: SKELETON_STEP_COUNT }, (_, index) => (
                <Skeleton
                  key={index}
                  className="h-10 w-28 shrink-0 rounded-lg md:w-full"
                />
              ))}
            </nav>
            <div className="space-y-8">
              <div className="space-y-6">
                <Skeleton className="h-7 w-48" />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                  {Array.from({ length: SKELETON_FIELD_COUNT }, (_, index) => (
                    <div key={index} className="space-y-2 md:col-span-6">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between gap-4 border-t pt-6">
                <Skeleton className="h-9 w-24" />
                <Skeleton className="h-9 w-36" />
              </div>
            </div>
          </div>
        </Box>
        <span className="sr-only">טוען את טופס עריכת הקו״ח…</span>
      </div>
    </Section>
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

  return (
    <EditStudentForm
      studentId={id}
      initialValues={studentToFormValues(student)}
      existingImageUrl={
        typeof student.image_url === "string" ? student.image_url : null
      }
      existingCvUrl={typeof student.cv_url === "string" ? student.cv_url : null}
      existingMedicalDocuments={existingMedicalDocuments(student)}
    />
  );
}
