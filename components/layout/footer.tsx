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
      <footer className="border-t border-[#dbe2e1] bg-[#eef2f1] text-[14px] text-[#5c6a68]">
        <div className="mx-auto max-w-[1120px] px-6 pb-[30px] pt-12">
          <div className="grid grid-cols-1 gap-9 border-b border-[#dbe2e1] pb-8 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1.4fr]">
            {/* Col 1 — Brand */}
            <div style={{ maxWidth: 340 }}>
              <div className="mb-[14px] flex items-center gap-[10px]">
                <LogoSvg size={30} className="text-[#2b5a5c]" />
                <span className="text-[18px] font-bold text-[#1b2523]">קול מצהלות</span>
              </div>
              <p className="leading-[1.65] text-[#66716f]">
                הארגון לקידום שידוכים בבעלזא — מערכת חדשנית להצעות וניהול שידוכים, בהמלצת ובפיקוח רבני קהילתנו הק׳.
              </p>
            </div>

            {/* Col 2 — Nav 1 */}
            <nav>
              <ul className="flex flex-col gap-[11px] list-none p-0 m-0">
                {[
                  { label: "מסלולים", href: "/pricing" },
                  { label: "תנאי שימוש", href: "/legal/terms-of-service" },
                  { label: "פרטיות", href: "/legal/privacy-policy" },
                  { label: "הצהרת נגישות", href: "/legal/accessibility" },
                  { label: "שירות ותמיכה", href: "/support" },
                ].map(({ label, href }) => (
                  <li key={label}>
                    <Link href={href as any} className="text-[#5c6a68] no-underline transition-colors hover:text-[#2b5a5c]">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            {/* Col 3 — Nav 2 */}
            <nav>
              <ul className="flex flex-col gap-[11px] list-none p-0 m-0">
                {[
                  { label: "אודות", href: "/about" },
                  { label: "לשדכנים", href: "/shadchanim" },
                  { label: "להורים ומיועדים", href: "/parents" },
                  { label: "מרכז הידע", href: "/knowledge" },
                  { label: "צרו קשר", href: "/contact" },
                ].map(({ label, href }) => (
                  <li key={label}>
                    <Link href={href as any} className="text-[#5c6a68] no-underline transition-colors hover:text-[#2b5a5c]">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            {/* Col 4 — Newsletter */}
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="mb-3 text-[15px] font-bold text-[#1b2523]">רשימת תפוצה</div>
              <p className="mb-[14px] text-[13.5px] leading-[1.6] text-[#66716f]">
                עדכונים ומאמרים מעולם השידוכים — ישירות אליכם למייל.
              </p>
              <div className="flex flex-col gap-[9px]">
                <input
                  type="email"
                  placeholder="כתובת מייל"
                  className="w-full rounded-full border border-[#d7dcdd] bg-white px-4 py-[11px] text-[14px] text-[#212927] outline-none transition focus:border-[#2b5a5c] focus:shadow-[0_0_0_2px_rgba(43,90,92,.25)]"
                />
                <button className="rounded-full border-none bg-[#2b5a5c] px-4 py-[11px] text-[14px] font-bold text-[#f4f8f7] transition hover:bg-[#234a4b]">
                  הרשמה
                </button>
              </div>
            </div>
          </div>

          <p className="mt-[22px] text-[13px] leading-[1.6] text-[#889492]">
            כל הזכויות שמורות © 2026 | קול מצהלות | אפיון וקופי:{" "}
            <Link href="https://natikugler.co.il/" target="_blank" className="text-[#66716f] no-underline">
              נתי קוגלר
            </Link>{" "}
            | עיצוב ופיתוח:{" "}
            <Link href="https://shos.digital/" target="_blank" className="text-[#66716f] no-underline">
              שוס דיגיטל
            </Link>
          </p>
        </div>
      </footer>
    );
  }

  return (
    <footer className={cn("border-t-foreground/10 container flex min-h-16 items-center justify-between border-t", className)}>
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
