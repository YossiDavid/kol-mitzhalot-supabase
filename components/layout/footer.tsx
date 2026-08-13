import Link from "next/link";
import { cn } from "@/lib/utils";
import { LogoSvg } from "@/components/website/logo-svg";
import { NewsletterSignup } from "@/components/website/newsletter-signup";

export default async function Footer({
  className,
  variant = "app",
}: {
  className?: string;
  variant?: "app" | "website";
}) {
  if (variant === "website") {
    return (
      <footer className="border-t border-border bg-muted text-body-sm text-muted-foreground">
        <div className="shell-site pt-16 pb-8 md:pt-20">
          <div className="grid grid-cols-2 gap-10 border-b border-border pb-10 lg:grid-cols-[1.5fr_1fr_1fr_1.4fr] lg:gap-12">
            <div className="col-span-2 sm:col-span-1 max-w-sm">
              <div className="mb-4 flex items-center gap-2.5">
                <LogoSvg size={30} className="text-primary" />
                <span className="text-subtitle font-bold text-foreground">
                  קול מצהלות
                </span>
              </div>
              {/* Callers: website footer. User: tighten leading a bit. */}
              <p className="text-muted-foreground">
                הארגון לקידום שידוכים בבעלזא — מערכת חדשנית להצעות וניהול
                שידוכים, בהמלצת ובפיקוח רבני קהילתנו הק׳.
              </p>
            </div>

            <nav>
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {[
                  { label: "מסלולים", href: "/pricing" },
                  { label: "תנאי שימוש", href: "/legal/terms-of-service" },
                  { label: "פרטיות", href: "/legal/privacy-policy" },
                  { label: "הצהרת נגישות", href: "/legal/accessibility" },
                  { label: "שירות ותמיכה", href: "/support" },
                ].map(({ label, href }) => (
                  <li key={label}>
                    <Link
                      href={href as any}
                      className="text-muted-foreground no-underline transition-colors hover:text-primary"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <nav>
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {[
                  { label: "אודות", href: "/about" },
                  { label: "לשדכנים", href: "/shadchanim" },
                  { label: "להורים ומיועדים", href: "/parents" },
                  { label: "מרכז הידע", href: "/knowledge" },
                  { label: "צרו קשר", href: "/contact" },
                ].map(({ label, href }) => (
                  <li key={label}>
                    <Link
                      href={href as any}
                      className="text-muted-foreground no-underline transition-colors hover:text-primary"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="col-span-2 lg:col-span-1">
              <div className="mb-3 text-body font-bold text-foreground">
                רשימת תפוצה
              </div>
              <p className="mb-4 text-body-sm text-muted-foreground">
                עדכונים ומאמרים מעולם השידוכים — ישירות אליכם למייל.
              </p>
              <NewsletterSignup />
            </div>
          </div>

          <p className="mt-6 text-body-sm text-muted-foreground">
            כל הזכויות שמורות © 2026 | קול מצהלות | אפיון וקופי:{" "}
            <Link
              href="https://natikugler.co.il/"
              target="_blank"
              className="text-muted-foreground no-underline transition-colors hover:text-primary"
            >
              נתי קוגלר
            </Link>{" "}
            | עיצוב ופיתוח:{" "}
            <Link
              href="https://shos.digital/"
              target="_blank"
              className="text-muted-foreground no-underline transition-colors hover:text-primary"
            >
              שוס דיגיטל
            </Link>
          </p>
        </div>
      </footer>
    );
  }

  return (
    <footer
      className={cn(
        "border-t-foreground/10 container flex min-h-16 items-center justify-between border-t",
        className,
      )}
    >
      <nav>
        <ul className="flex gap-4">
          <li>
            <Link href="/pricing">מסלולים</Link>
          </li>
          <li>
            <Link href="/legal/terms-of-service">תנאי שימוש</Link>
          </li>
          <li>
            <Link href="/legal/privacy-policy">פרטיות</Link>
          </li>
          <li>
            <Link href="/legal/accessibility">הצהרת נגישות</Link>
          </li>
          <li>
            <Link href="/support">שירות ותמיכה</Link>
          </li>
        </ul>
      </nav>
      <p>
        כל הזכויות שמורות © 2026 | קול מצהלות | אפיון וקופי:{" "}
        <Link href="https://natikugler.co.il/" target="_blank">
          נתי קוגלר
        </Link>{" "}
        | עיצוב ופיתוח:{" "}
        <Link href="https://shos.digital/" target="_blank">
          שוס דיגיטל
        </Link>
      </p>
    </footer>
  );
}
