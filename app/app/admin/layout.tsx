import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

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
  const isAdmin = user?.user_metadata?.role === "admin";

  if (!isAdmin) {
    redirect("/app");
  }

  return <>{children}</>;
}
