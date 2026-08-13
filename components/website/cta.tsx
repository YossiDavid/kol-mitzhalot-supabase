import Link from "next/link";
import { LogoSvg } from "@/components/website/logo-svg";
import { Button } from "@/components/ui/button";

function ArrowIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  );
}

/* מסלולי הרשמה — מוסתרים בינתיים (כולם נרשמים לאותו מקום)
const signupPaths = [
  { label: "הורים ומיועדים", href: "/auth/sign-up" as const },
  { label: "שדכנים ושדכניות", href: "/auth/sign-up" as const },
  { label: "רבנים וצוותי חינוך", href: "/auth/sign-up" as const },
];
*/

export function WebCta() {
  return (
    <section className="relative overflow-hidden bg-primary text-primary-foreground">
      <div className="bg-brand-gold-wash pointer-events-none absolute inset-0" />

      <div className="relative shell-site grid grid-cols-1 items-center gap-10 py-20 pb-36 md:grid-cols-[1.15fr_0.85fr] md:gap-16 md:py-24 md:pb-24">
        <div className="relative z-10 text-center md:text-start">
          <h2 className="mb-8 text-display leading-[1.14] font-bold text-balance text-primary-foreground">
            מערכת קול מצהלות כאן בשבילכם,
            <br />
            <span
              className="mt-2 inline-block rounded-xl"
              style={{
                background: "var(--primary-foreground)",
                color: "var(--primary)",
                padding: "1px 16px 5px",
                transform: "rotate(-1.5deg)",
              }}
            >
              הירשמו עכשיו!
            </span>
          </h2>

          <Button
            asChild
            size="lg"
            className="bg-brand-gold text-brand-gold-foreground hover:bg-brand-gold-soft active:bg-brand-gold-muted"
          >
            <Link href={"/auth/sign-up" as any}>
              הירשמו עכשיו ללא עלות <ArrowIcon />
            </Link>
          </Button>
        </div>

        {/* גרסה קודמת — כרטיסי «הצעה נשלחה» / «מזל טוב» (חוזר על ההירו)
        <div className="relative hidden min-h-[200px] md:block">
          <div
            className="absolute flex items-center gap-[13px] rounded-2xl bg-card"
            style={{
              top: 10,
              right: 0,
              width: 280,
              maxWidth: "100%",
              padding: "16px 18px",
              boxShadow: "0 28px 54px -22px rgba(0,0,0,.6)",
              transform: "rotate(-3deg)",
            }}
          >
            <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[12px] bg-primary-wash">
              ✓
            </span>
            <div className="text-right">
              <div className="text-body font-bold text-foreground">הצעה נשלחה</div>
              <div className="text-caption text-muted-foreground">ממתינה לתגובת הצדדים</div>
            </div>
          </div>
          <div
            className="absolute flex items-center gap-[13px] rounded-2xl bg-card"
            style={{
              bottom: 0,
              left: 6,
              width: 260,
              maxWidth: "100%",
              padding: "16px 18px",
              boxShadow: "0 28px 54px -22px rgba(0,0,0,.6)",
              transform: "rotate(3deg)",
            }}
          >
            <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[12px] bg-brand-gold-muted">
              ♥
            </span>
            <div className="text-right">
              <div className="text-body font-bold text-foreground">מזל טוב!</div>
              <div className="text-caption text-muted-foreground">שידוך נסגר בשעה טובה</div>
            </div>
          </div>
        </div>
        */}

        {/* מסלולי הרשמה — מוסתרים בינתיים (כולם נרשמים לאותו מקום)
        <div>
          <p className="mb-4 text-body-sm text-primary-foreground/80">
            הרשמה לפי סוג:
          </p>
          <div className="flex flex-col gap-3">
            {signupPaths.map(({ label, href }) => (
              <Button
                key={label}
                asChild
                size="lg"
                variant="outline"
                className="h-auto w-full justify-between border-primary-foreground/40 px-5 py-4 text-primary-foreground shadow-none hover:bg-primary-foreground/10 hover:text-primary-foreground active:bg-primary-foreground/15"
              >
                <Link href={href as any}>
                  {label}
                  <ArrowIcon />
                </Link>
              </Button>
            ))}
          </div>
        </div>
        */}

        {/* Mobile: large watermark cropped at section bottom (below content) */}
        <div
          className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-[55%] opacity-20 md:hidden"
          aria-hidden="true"
        >
          <LogoSvg
            size={380}
            className="-rotate-[8deg] text-primary-foreground"
          />
        </div>

        {/* Desktop: spacer + cropped watermark logo */}
        <div className="hidden md:block" aria-hidden="true" />
        <div
          className="pointer-events-none absolute bottom-0 left-0 hidden origin-bottom-left -rotate-[8deg] translate-y-1/2 opacity-20 md:block"
          aria-hidden="true"
        >
          <LogoSvg size={560} className="text-primary-foreground" />
        </div>
      </div>
    </section>
  );
}
