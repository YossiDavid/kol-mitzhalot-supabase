import { createClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/user";
import { redirect } from "next/navigation";

export default async function StudentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
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
