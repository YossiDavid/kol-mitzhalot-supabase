import Link from "next/link";
import { DeployButton } from "@/components/deploy-button";
import { Suspense } from "react";
import { AuthButton } from "@/components/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { createClient } from "@/lib/supabase/server";
import HeaderIcons from "./icons";
import { Button } from "../../ui/button";
import { Separator } from "../../ui/separator";
import Image from "next/image";
import Logo from "@/assets/images/logo_negative_text.svg"


export default async function Header({ variant }: { variant: "app" | "website" }) {
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
        {variant === "app" && (
          <>
            <SidebarTrigger className="z-20 -ms-1" />
            <Separator
              orientation="vertical"
              className="bg-primary mx-2 data-[orientation=vertical]:h-4"
            />
            <div className="flex items-center gap-5 font-semibold">
              שלום וברכה, {firstName} {lastName}!
            </div>
            {user?.user_metadata?.role === "admin" && (
              <Button variant={"link"} asChild>
                <Link href="/app/admin">למערכת ניהול</Link>
              </Button>
            )}
          </>
        )}
        {variant === "website" && (
          <div className="flex items-center gap-5 font-semibold">
            <Link href="/"><Image src={Logo.src} alt="logo" width={200} height={100} /></Link>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <HeaderIcons />

        <Suspense>
          <AuthButton />
        </Suspense>
        {variant === "app" && (
          <Button asChild>
            {user?.user_metadata?.role !== "shadchan" ? (
              <Link href={"/app/students/create"}>הוספת מיועדים למערכת</Link>
            ) : (
              <Link href={"/"}>לרשימת המיועדים</Link>
            )}
          </Button>
        )}
        {variant === "website" && user && (
          <Button asChild>
            <Link href="/app">לכניסה למערכת</Link>
          </Button>
        )}
      </div>
    </header>
  );
}
