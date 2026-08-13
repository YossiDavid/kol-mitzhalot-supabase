import Link from "next/link";
import { cn } from "@/lib/utils";
import { LogoSvg } from "@/components/website/logo-svg";

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
        <div className="mx-auto max-w-[1120px] px-6 pt-12 pb-[30px]">
          <div className="grid grid-cols-2 gap-9 border-b border-border pb-8 lg:grid-cols-[1.5fr_1fr_1fr_1.4fr]">
            {/* Col 1 — Brand */}
            <div className="col-span-2 sm:col-span-1" style={{ maxWidth: 340 }}>
              <div className="mb-[14px] flex items-center gap-[10px]">
                <LogoSvg size={30} className="text-primary" />
                <span className="text-subtitle font-bold text-foreground">
                  קול מצהלות
                </span>
              </div>
              <p className="leading-[1.65] text-muted-foreground">
                הארגון לקידום שידוכים בבעלזא — מערכת חדשנית להצעות וניהול
                שידוכים, בהמלצת ובפיקוח רבני קהילתנו הק׳.
              </p>
            </div>

            {/* Col 2 — Nav 1 */}
            <nav>
              <ul className="m-0 flex list-none flex-col gap-[11px] p-0">
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

            {/* Col 3 — Nav 2 */}
            <nav>
              <ul className="m-0 flex list-none flex-col gap-[11px] p-0">
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

            {/* Col 4 — Newsletter */}
            <div className="col-span-2 lg:col-span-1">
              <div className="mb-3 text-body font-bold text-foreground">
                רשימת תפוצה
              </div>
              <p className="mb-[14px] text-body-sm leading-[1.6] text-muted-foreground">
                עדכונים ומאמרים מעולם השידוכים — ישירות אליכם למייל.
              </p>
              <div className="flex flex-col gap-[9px]">
                <input
                  type="email"
                  placeholder="כתובת מייל"
                  className="w-full rounded-full border border-border bg-card px-4 py-[11px] text-body-sm text-foreground transition outline-none focus:border-primary focus:ring-primary-focus-sm"
                />
                <button className="rounded-full border-none bg-primary px-4 py-[11px] text-body-sm font-bold text-primary-foreground transition hover:bg-primary-active">
                  הרשמה
                </button>
              </div>
            </div>
          </div>

          <p className="mt-[22px] text-body-sm leading-[1.6] text-muted-foreground">
            כל הזכויות שמורות © 2026 | קול מצהלות | אפיון וקופי:{" "}
            <Link
              href="https://natikugler.co.il/"
              target="_blank"
              className="text-muted-foreground no-underline"
            >
              נתי קוגלר
            </Link>{" "}
            | עיצוב ופיתוח:{" "}
            <Link
              href="https://shos.digital/"
              target="_blank"
              className="text-muted-foreground no-underline"
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
