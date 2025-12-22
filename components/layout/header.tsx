import Link from "next/link";
import { DeployButton } from "@/components/deploy-button";
import { Suspense } from "react";
import { AuthButton } from "@/components/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { createClient } from "@/lib/supabase/server";
import HeaderIcons from "./header/icons";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";

export default async function Header() {
  const supabase = await createClient();

  // You can also use getUser() which will be slower.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const firstName = user?.user_metadata?.firstName as string;
  const lastName = user?.user_metadata?.lastName as string;

  return (
    <header className="border-b-foreground/10 container flex h-16 items-center justify-between gap-5 border-b font-semibold">
      <div className="flex items-center justify-between">
        <SidebarTrigger className="z-20 -ms-1" />
        <Separator
          orientation="vertical"
          className="bg-primary mx-2 data-[orientation=vertical]:h-4"
        />
        <div className="flex items-center gap-5 font-semibold">
          שלום וברכה, {firstName} {lastName}!
        </div>
      </div>

      <div className="flex gap-2">
        <HeaderIcons />

        <Suspense>
          <AuthButton />
        </Suspense>
        <Button asChild>
          {user?.user_metadata?.role !== "shadchan" ? (
            <Link href={"/app/students/create"}>הוספת מיועדים למערכת</Link>
          ) : (
            <Link href={"/"}>לרשימת המיועדים</Link>
          )}
        </Button>
      </div>
    </header>
  );
}
