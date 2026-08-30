import { createClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/user";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

// כרטיס מיועד בודד (/app/students/<id>) פתוח גם לגולש לא מחובר, בגרסה
// מצומצמת. הרשימה עצמה (/app/students) ויצירת כרטיס עדיין דורשות התחברות.
// הנתיב מגיע מ-x-pathname שנקבע ב-middleware, כי layout אינו יכול לקרוא אותו.
const PUBLIC_STUDENT_CARD_PATH_REGEX = /^\/app\/students\/(?!create$)[^/]+$/;

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

  // איש צוות מאושר גם רשאי להיכנס - RLS (staff_can_access_student, ראה
  // supabase/migrations/20260830170000_student_notes.sql) כבר מגביל את
  // הרשימה שהוא יראה למיועדים של המוסד שלו בלבד.
  if (
    !hasRole(user, "admin") &&
    !hasRole(user, "shadchan") &&
    !hasRole(user, "staff")
  ) {
    redirect("/app");
  }

  return <>{children}</>;
}
