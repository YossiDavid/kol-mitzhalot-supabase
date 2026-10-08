import Link from "next/link";
import { Suspense } from "react";
import { Globe, HeartHandshake, ShieldCheck } from "lucide-react";
import { AuthButton } from "@/components/auth-button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { createClient } from "@/lib/supabase/server";
import { getUser, hasRole } from "@/lib/user";
import { getRoleLabel, getRoles } from "@/lib/user-role";
import { formatFullName, resolveDisplayName } from "@/lib/user-display-name";
import HeaderIcons from "./icons";
import { UserMenu } from "./user-menu";
import { Button } from "../../ui/button";
import { Separator } from "../../ui/separator";
import Image from "next/image";
import Logo from "@/assets/images/logo-text.svg";
import { WebMobileNav } from "./mobile-nav";
import { AdminMobileMenuTrigger } from "./admin-mobile-menu";
import { readSignupPurpose } from "@/features/auth/lib/signup-purpose";
import { ENDORSEMENTS_HREF } from "@/components/website/endorsements-anchor";

/** השם מתוך user_profiles, לברכה בהדר. כשל בשליפה אינו חוסם את ההדר */
async function loadHeaderProfile(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_profiles")
    .select("first_name, last_name")
    .eq("id", userId)
    .maybeSingle();
  return data;
}

export default async function Header({
  variant,
}: {
  variant: "app" | "website";
}) {
  // getUser הממוזכר (lib/user): המעטפת והדפים כבר קראו אותו באותה בקשה, ולכן
  // ההדר אינו פונה שוב לשרת האימות.
  const user = await getUser();

  // ההדר קרא בעבר רק את user_metadata.firstName/lastName ב-camelCase, ולכן
  // הציג ברכה ריקה כשהשם שמור ב-snake_case או רק ב-user_profiles.
  // resolveDisplayName מכסה את כל המקורות, כמו בשאר האפליקציה.
  // הברכה מוצגת רק בהדר של /app - בהדר האתר אין שם, ולכן אין שאילתה.
  const profile =
    user && variant === "app" ? await loadHeaderProfile(user.id) : null;

  const { firstName, lastName } = user
    ? resolveDisplayName(user, profile)
    : { firstName: null, lastName: null };
  const greetingName = formatFullName(firstName, lastName);
  const greeting = greetingName
    ? `שלום וברכה, ${greetingName}!`
    : "שלום וברכה!";
  // סוגי המשתמש בסוגריים אחרי השם. getRoles מחזיר ["user"] כברירת
  // מחדל, ולכן לכל משתמש מחובר תמיד יש לפחות תווית אחת.
  const roleLabels = user ? getRoles(user).map(getRoleLabel).join(", ") : "";
  // הצטרפות כשדכן/איש צוות מוצגת רק אם למשתמש עדיין אין את התפקיד הזה בפועל
  // (ולא רק אם יש לו תפקיד "אחר" - משתמש יכול להיות גם וגם)
  const showShadchanJoin =
    !hasRole(user, "shadchan") && !hasRole(user, "admin");
  const showStaffJoin = !hasRole(user, "staff") && !hasRole(user, "admin");

  if (variant === "website") {
    return (
      <header className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="shell-site flex h-16 items-center justify-between gap-4">
          <Link href="/" className="flex shrink-0 items-center no-underline">
            <Image
              src={Logo.src}
              alt="קול מצהלות"
              width={160}
              height={45}
              className="h-9 w-auto"
              priority
            />
          </Link>

          <nav className="hidden items-center gap-6 xl:flex">
            {[
              { label: "בית", href: "/" },
              { label: "אודות", href: "/about" },
              { label: "מרכז הידע", href: "/knowledge" },
              { label: "מה חדש", href: "/whats-new" },
              { label: "הסכמות והמלצות", href: ENDORSEMENTS_HREF },
              { label: "קול מצהלות לשדכנים", href: "/shadchanim" },
              { label: "קול מצהלות להורים ומיועדים", href: "/parents" },
              { label: "צרו קשר", href: "/contact" },
            ].map(({ label, href }) => (
              <Link
                key={href}
                href={href as any}
                className="text-body-sm font-medium text-muted-foreground no-underline transition-colors hover:text-foreground"
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            {/* מתחת ל-sm אין מקום ליד "הרשמה חינם"; שם הכפתור בראש תפריט המובייל */}
            <Button
              asChild
              variant="outline"
              className="hidden border-brand-gold text-foreground hover:bg-brand-gold-muted active:bg-brand-gold-muted sm:inline-flex dark:border-brand-gold dark:hover:bg-brand-gold-muted dark:hover:text-brand-gold-foreground"
            >
              <Link href="/donations">
                <HeartHandshake
                  className="text-brand-gold"
                  aria-hidden="true"
                />
                לתרומות
              </Link>
            </Button>
            <WebMobileNav isLoggedIn={!!user} />
            {/* משתמש מחובר שגולש באתר חוזר למערכת, ולא מופנה שוב לכניסה */}
            {user ? (
              <Button asChild>
                <Link href="/app">לאזור האישי</Link>
              </Button>
            ) : (
              <>
                <Button
                  asChild
                  variant="ghost"
                  className="hidden xl:inline-flex"
                >
                  <Link href={"/auth/login" as any}>כניסה</Link>
                </Button>
                <Button asChild>
                  <Link href={"/auth/sign-up" as any}>הרשמה חינם</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-30 container flex h-16 items-center justify-between gap-5 border-b border-b-foreground/10 bg-background/95 font-semibold backdrop-blur-sm supports-[backdrop-filter]:bg-background/80">
      <div className="flex min-w-0 items-center gap-2">
        <>
          {/* מובייל, מנהל בתוך /app/admin: תפריט הניהול */}
          {hasRole(user, "admin") && <AdminMobileMenuTrigger />}
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
            className="mx-2 hidden bg-primary data-[orientation=vertical]:h-4 md:block"
          />
          {/* שורה אחת שנקטעת בשלוש נקודות; התווית של התפקיד נעלמת קודם (מתחת ל-2xl) */}
          <div
            className="hidden min-w-0 items-center gap-5 font-semibold md:flex"
            title={greeting}
          >
            <span className="truncate">{greeting}</span>
            {roleLabels && (
              <span className="hidden shrink-0 font-normal text-muted-foreground 2xl:inline">
                ({roleLabels})
              </span>
            )}
          </div>
          {hasRole(user, "admin") && (
            <Button
              variant={"link"}
              asChild
              className="hidden shrink-0 md:inline-flex"
            >
              <Link href="/app/admin" title="למערכת ניהול">
                {/* מתחת ל-xl רק אייקון, כדי שהברכה לא תיקצץ; הטקסט נשאר לקוראי מסך */}
                <ShieldCheck aria-hidden="true" className="xl:hidden" />
                <span className="sr-only xl:not-sr-only">למערכת ניהול</span>
              </Link>
            </Button>
          )}
        </>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {/* מעבר לאתר הציבורי: מ-xl ומעלה בלבד. מתחת לזה הקישור נשאר בפוטר סרגל
            הצד ובתפריט המשתמש, כדי שהברכה לא תיקצץ */}
        <Button
          asChild
          variant="outline"
          size="sm"
          className="hidden xl:inline-flex"
        >
          <Link
            href="/"
            aria-label="לאתר קול מצהלות"
            title="לאתר קול מצהלות"
            data-testid="header-site-link"
          >
            <Globe aria-hidden="true" />
            <span>לאתר קול מצהלות</span>
          </Link>
        </Button>
        <HeaderIcons hasUserMenu={!!user} userId={user?.id ?? null} />

        {user ? (
          <UserMenu
            showShadchanJoin={showShadchanJoin}
            showStaffJoin={showStaffJoin}
            highlightShadchanJoin={
              showShadchanJoin && readSignupPurpose(user) === "shadchan"
            }
          />
        ) : (
          <Suspense>
            <AuthButton />
          </Suspense>
        )}
        <Button asChild className="hidden md:flex">
          {!hasRole(user, "shadchan") ? (
            <Link href={"/app/students/create"}>הוספת מיועדים למערכת</Link>
          ) : (
            // "/" היה דף הבית של האתר, עם כפתורי כניסה - לא המקום שאליו שדכן מחובר מצפה להגיע
            <Link href="/app">לרשימת המיועדים</Link>
          )}
        </Button>
      </div>
    </header>
  );
}
