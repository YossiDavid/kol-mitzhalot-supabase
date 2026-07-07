import Link from "next/link";
import { Suspense } from "react";
import { AuthButton } from "@/components/auth-button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveRole } from "@/lib/user";
import HeaderIcons from "./icons";
import { UserMenu } from "./user-menu";
import { Button } from "../../ui/button";
import { Separator } from "../../ui/separator";
import Image from "next/image";
import Logo from "@/assets/images/logo-text.svg";
import { LogoSvg } from "@/components/website/logo-svg";

export default async function Header({ variant }: { variant: "app" | "website" }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const firstName = user?.user_metadata?.firstName as string;
  const lastName = user?.user_metadata?.lastName as string;
  const role = user ? getEffectiveRole(user) : null;
  const showShadchanJoin =
    role === "user" || (role !== "admin" && role !== "shadchan");

  if (variant === "website") {
    return (
      <header
        className="sticky top-0 z-40 flex h-[69px] items-center justify-between gap-5 border-b border-[rgba(43,90,92,.13)]"
        style={{
          background: "rgba(236,240,242,.82)",
          backdropFilter: "saturate(180%) blur(10px)",
          WebkitBackdropFilter: "saturate(180%) blur(10px)",
          paddingInline: "clamp(20px,4vw,56px)",
        }}
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-[10px] no-underline">
          <LogoSvg size={34} className="text-[#2b5a5c]" />
          <span className="text-[20px] font-bold text-[#1b2523] tracking-[-0.01em]">קול מצהלות</span>
        </Link>

        {/* Nav */}
        <nav className="hidden items-center gap-[22px] lg:flex">
          {[
            { label: "בית", href: "/" },
            { label: "אודות", href: "/about" },
            { label: "מרכז הידע", href: "/knowledge" },
            { label: "מה חדש", href: "/whats-new" },
            { label: "קול מצהלות לשדכנים", href: "/shadchanim" },
            { label: "קול מצהלות להורים ומיועדים", href: "/parents" },
            { label: "צרו קשר", href: "/contact" },
          ].map(({ label, href }) => (
            <Link
              key={href}
              href={href as any}
              className="text-[15px] font-medium text-[#5c6a68] no-underline transition-colors hover:text-[#1b2523]"
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Auth */}
        <div className="flex shrink-0 items-center gap-[10px]">
          <Link
            href={"/auth/login" as any}
            className="px-1.5 py-2 text-[15px] font-semibold text-[#2b5a5c] no-underline transition-colors hover:text-[#234a4b]"
          >
            כניסה
          </Link>
          <Link
            href={"/auth/sign-up" as any}
            className="rounded-full bg-[#2b5a5c] px-5 py-[10px] text-[14px] font-bold text-[#f7faf9] no-underline shadow-[0_6px_16px_-8px_rgba(43,90,92,.7)] transition-colors hover:bg-[#234a4b]"
          >
            הרשמה חינם
          </Link>
        </div>
      </header>
    );
  }

  return (
    <header className="border-b-foreground/10 container sticky top-0 z-30 flex h-16 items-center justify-between gap-5 border-b bg-background/95 font-semibold backdrop-blur-sm supports-[backdrop-filter]:bg-background/80">
      <div className="flex items-center gap-2">
        <>
          {/* מובייל: לוגו */}
          <Link href="/app" className="md:hidden">
            <Image src={Logo.src} alt="קול מצהלות" width={140} height={40} className="h-8 w-auto" />
          </Link>
          {/* דסקטופ: טריגר + ברכה */}
          <SidebarTrigger className="z-20 -ms-1 hidden md:inline-flex" />
          <Separator
            orientation="vertical"
            className="bg-primary mx-2 hidden data-[orientation=vertical]:h-4 md:block"
          />
          <div className="hidden items-center gap-5 font-semibold md:flex">
            שלום וברכה, {firstName} {lastName}!
          </div>
          {user?.user_metadata?.role === "admin" && (
            <Button variant={"link"} asChild className="hidden md:inline-flex">
              <Link href="/app/admin">למערכת ניהול</Link>
            </Button>
          )}
        </>
      </div>

      <div className="flex gap-2">
        <HeaderIcons hasUserMenu={!!user} />

        {user ? (
          <UserMenu showShadchanJoin={showShadchanJoin} />
        ) : (
          <Suspense>
            <AuthButton />
          </Suspense>
        )}
        <Button asChild className="hidden md:flex">
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
