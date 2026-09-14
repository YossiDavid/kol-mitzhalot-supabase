import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Skeleton } from "@/components/ui/skeleton";
import { StudentsNoAccess } from "@/features/students/components/no-access";
import { getUser, hasRole } from "@/lib/user";

// כרטיס מיועד בודד (/app/students/<id>) פתוח גם לגולש לא מחובר, בגרסה
// מצומצמת. הרשימה עצמה (/app/students) ויצירת כרטיס עדיין דורשות התחברות.
// הנתיב מגיע מ-x-pathname שנקבע ב-middleware, כי layout אינו יכול לקרוא אותו.
const PUBLIC_STUDENT_CARD_PATH_REGEX = /^\/app\/students\/(?!create$)[^/]+$/;

// רשימת המיועדים היא כלי עבודה שחושף מיועדים של אחרים, ולכן סגורה
// להורה. יצירת כרטיס וכרטיס של ילד בודד נשארים פתוחים לו.
const STUDENTS_LIST_PATH_REGEX = /^\/app\/students\/?$/;

function StudentsSkeleton() {
  return (
    <div role="status" aria-label="טוען" className="space-y-3 py-4">
      <Skeleton className="h-7 w-44" />
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}

/**
 * השער הזה אינו מפנה בלבד: ברשימה הוא מחליף את התוכן במסך "אין גישה",
 * ולכן הוא עוטף את ה-children ולא יושב לצידם. הקריאה לסשן נשארת מאחורי
 * ה-Suspense שמתחת, כדי שמעטפת /app תישאר סטטית.
 */
async function StudentsGate({ children }: { children: React.ReactNode }) {
  const pathname = (await headers()).get("x-pathname") ?? "";
  const isPublicStudentCard = PUBLIC_STUDENT_CARD_PATH_REGEX.test(pathname);

  const user = await getUser();

  if (!user) {
    if (isPublicStudentCard) return <>{children}</>;
    redirect("/auth/login");
  }

  // הרשימה בלבד מוגבלת לפי תפקיד. שאר הנתיבים (יצירה וכרטיס בודד)
  // פתוחים, ו-RLS מצמצם כל אחד למה שמותר לו:
  //   - הורה       — auth.uid() = students.user_id (הילדים שלו בלבד)
  //   - איש צוות   — staff_can_access_student (המיועדים של המוסד שלו)
  //   - שדכן/אדמין — is_shadchan_or_admin (הכל)
  // ראה supabase/migrations/20260830170000_student_notes.sql:134-145.
  if (
    STUDENTS_LIST_PATH_REGEX.test(pathname) &&
    !hasRole(user, "admin") &&
    !hasRole(user, "shadchan") &&
    !hasRole(user, "staff")
  ) {
    // הודעה ולא redirect: הפניה שקטה נראית כמו תקלה.
    return <StudentsNoAccess />;
  }

  return <>{children}</>;
}

export default function StudentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<StudentsSkeleton />}>
      <StudentsGate>{children}</StudentsGate>
    </Suspense>
  );
}
