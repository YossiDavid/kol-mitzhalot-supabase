import { createClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/user";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

// כרטיס מיועד בודד (/app/students/<id>) פתוח גם לגולש לא מחובר, בגרסה
// מצומצמת. הרשימה עצמה (/app/students) ויצירת כרטיס עדיין דורשות התחברות.
// הנתיב מגיע מ-x-pathname שנקבע ב-middleware, כי layout אינו יכול לקרוא אותו.
const PUBLIC_STUDENT_CARD_PATH_REGEX = /^\/app\/students\/(?!create$)[^/]+$/;

// רשימת המיועדים היא כלי עבודה שחושף מיועדים של אחרים, ולכן סגורה
// להורה. יצירת כרטיס וכרטיס של ילד בודד נשארים פתוחים לו.
const STUDENTS_LIST_PATH_REGEX = /^\/app\/students\/?$/;

export default async function StudentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = (await headers()).get("x-pathname") ?? "";
  const isPublicStudentCard = PUBLIC_STUDENT_CARD_PATH_REGEX.test(pathname);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
    redirect("/app");
  }

  return <>{children}</>;
}
