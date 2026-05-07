import { createClient } from "@/lib/supabase/server";
import { getEffectiveRole } from "@/lib/user";
import { redirect } from "next/navigation";

export default async function CanvasLayout({
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

  const role = getEffectiveRole(user);
  if (role !== "admin" && role !== "shadchan") {
    redirect("/app");
  }

  return <>{children}</>;
}
