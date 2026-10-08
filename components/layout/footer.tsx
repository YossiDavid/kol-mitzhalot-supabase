import Link from "next/link";
import LogoText from "@/assets/images/logo-text.svg";
import { SITE_CONTENT_LINKS } from "@/components/layout/site-content-links";
import { cn } from "@/lib/utils";
import { LogoSvg } from "@/components/website/logo-svg";
import { ENDORSEMENTS_HREF } from "@/components/website/endorsements-anchor";
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
            <div className="col-span-2 max-w-sm sm:col-span-1">
              <div className="mb-4 flex items-center gap-2.5">
                <LogoSvg size={30} className="text-primary" />
                <span className="text-subtitle font-bold text-foreground">
                  קול מצהלות
                </span>
              </div>
              {/* Callers: website footer. User: tighten leading a bit. */}
              <p className="text-muted-foreground">
                הארגון לקידום שידוכים בציבור החסידי — מערכת חדשנית להצעות וניהול
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
                  { label: "תרומות והנצחות", href: "/donations" },
                  { label: "הסכמות והמלצות", href: ENDORSEMENTS_HREF },
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

  return <AppFooter className={className} />;
}

type FooterLink = { title: string; href: string };
type FooterColumn = { id: string; heading: string; links: FooterLink[] };

/** קישור מתוך רשימת תוכן האתר המשותפת, כדי שהכתובות לא יוגדרו פעמיים */
function contentLink(href: (typeof SITE_CONTENT_LINKS)[number]["href"]) {
  const link = SITE_CONTENT_LINKS.find((item) => item.href === href);
  if (!link) throw new Error(`חסר קישור תוכן: ${href}`);
  return { title: link.title, href: link.href };
}

const FOOTER_COLUMNS: readonly FooterColumn[] = [
  {
    id: "info",
    heading: "מידע",
    links: [
      contentLink("/about"),
      contentLink("/knowledge"),
      contentLink("/whats-new"),
      { title: "מסלולים", href: "/pricing" },
    ],
  },
  {
    id: "support",
    heading: "תמיכה",
    links: [contentLink("/support"), contentLink("/donations")],
  },
  {
    id: "legal",
    heading: "משפטי",
    links: [
      { title: "תנאי שימוש", href: "/legal/terms-of-service" },
      { title: "פרטיות", href: "/legal/privacy-policy" },
      { title: "הצהרת נגישות", href: "/legal/accessibility" },
    ],
  },
];

const LINK_CLASS =
  "rounded-sm text-body-sm whitespace-nowrap text-muted-foreground transition-colors hover:text-primary focus-visible:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

function CreditLink({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href as never}
      target="_blank"
      className={cn(LINK_CLASS, "text-caption")}
    >
      {children}
    </Link>
  );
}

/**
 * פוטר האפליקציה: מותג ושורת זכויות בצד ההתחלה, ועמודות קישורים עם כותרת.
 * אין בלוק רשתות חברתיות - אין בפרויקט קישורי רשתות של הארגון.
 * מוסתר מתחת ל-md על ידי className (הסרגל התחתון מחליף אותו).
 */
export function AppFooter({ className }: { className?: string }) {
  const year = new Date().getFullYear();

  return (
    <footer className={cn("border-t border-border", className)}>
      <div className="container flex flex-col gap-10 py-10 lg:flex-row lg:justify-between lg:gap-16">
        <div className="flex max-w-sm flex-col gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LogoText.src} alt="קול מצהלות" className="h-auto w-40" />
          <p className="text-body-sm text-muted-foreground">
            © {year} קול מצהלות
          </p>
          <p className="text-body-sm text-muted-foreground">
            כל הזכויות שמורות
          </p>
          <p className="text-caption text-muted-foreground">
            אפיון וקופי:{" "}
            <CreditLink href="https://natikugler.co.il/">נתי קוגלר</CreditLink>{" "}
            | עיצוב ופיתוח:{" "}
            <CreditLink href="https://shos.digital/">שוס דיגיטל</CreditLink>
          </p>
        </div>

        <div className="flex flex-wrap gap-x-16 gap-y-8 lg:justify-end">
          {FOOTER_COLUMNS.map((column) => (
            <nav
              key={column.id}
              aria-labelledby={`footer-${column.id}`}
              className="flex flex-col gap-3"
            >
              <p
                id={`footer-${column.id}`}
                className="text-body font-bold text-foreground"
              >
                {column.heading}
              </p>
              <ul className="flex flex-col gap-2">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href as never} className={LINK_CLASS}>
                      {link.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>
    </footer>
  );
}
