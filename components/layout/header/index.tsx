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
import { WebMobileNav } from "./mobile-nav";

export default async function Header({
  variant,
}: {
  variant: "app" | "website";
}) {
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
        className="sticky top-0 z-40 flex h-[69px] items-center justify-between gap-5 border-b border-primary/13"
        style={{
          background: "rgba(236,240,242,.82)",
          backdropFilter: "saturate(180%) blur(10px)",
          WebkitBackdropFilter: "saturate(180%) blur(10px)",
          paddingInline: "clamp(20px,4vw,56px)",
        }}
      >
        {/* Logo */}
        <Link href="/" className="flex items-center no-underline">
          <Image
            src={Logo.src}
            alt="קול מצהלות"
            width={160}
            height={45}
            className="h-[38px] w-auto"
            priority
          />
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
              className="text-body font-medium text-muted-foreground no-underline transition-colors hover:text-foreground"
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Auth */}
        <div className="flex shrink-0 items-center gap-[10px]">
          <WebMobileNav />
          <Link
            href={"/auth/login" as any}
            className="hidden px-1.5 py-2 text-body font-semibold text-primary no-underline transition-colors hover:text-primary lg:block"
          >
            כניסה
          </Link>
          <Link
            href={"/auth/sign-up" as any}
            className="rounded-full bg-primary px-5 py-[10px] text-body-sm font-bold text-primary-foreground no-underline shadow-primary-header transition-colors hover:bg-primary-active"
          >
            הרשמה חינם
          </Link>
        </div>
      </header>
    );
  }

  return (
    <header className="border-b-foreground/10 bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-30 container flex h-16 items-center justify-between gap-5 border-b font-semibold backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <>
          {/* מובייל: לוגו */}
          <Link href="/app" className="md:hidden">
            <Image
              src={Logo.src}
              alt="קול מצהלות"
              width={140}
              height={40}
              className="h-8 w-auto"
            />
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
