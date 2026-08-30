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

  if (!hasRole(user, "admin") && !hasRole(user, "shadchan")) {
    redirect("/app");
  }

  return <>{children}</>;
}
