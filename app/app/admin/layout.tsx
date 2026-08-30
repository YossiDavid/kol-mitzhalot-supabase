import { createClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/user";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // בדיקה שהמשתמש הוא אדמין
  const isAdmin = hasRole(user, "admin");

  if (!isAdmin) {
    redirect("/app");
  }

  return <>{children}</>;
}
