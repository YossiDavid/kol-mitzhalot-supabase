import Link from "next/link";
import { LogoSvg } from "@/components/website/logo-svg";

function CheckIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--brand-gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  );
}

export function WebCta() {
  return (
    <section className="bg-background">
      <div className="mx-auto max-w-[1160px] px-6 pb-[72px] pt-6">
        <div
          className="relative overflow-hidden rounded-[30px] bg-primary-gradient text-primary-foreground shadow-[0_46px_90px_-46px_rgba(12,45,43,.7)]"
        >
          {/* Gold radial overlay */}
          <div className="bg-brand-gold-wash pointer-events-none absolute inset-0" />
          {/* Brand SVG watermark */}
          <LogoSvg
            size={500}
            className="pointer-events-none absolute"
            style={{ bottom: -160, left: -90, color: "color-mix(in oklab, var(--brand-gold) 12%, transparent)" } as React.CSSProperties}
          />

          {/* Inner grid */}
          <div className="relative grid grid-cols-1 items-center gap-8 p-8 md:grid-cols-[1.15fr_.85fr] md:p-14">
            {/* Text column */}
            <div>
              <h2
                className="font-bold leading-[1.14] text-primary-foreground text-display" style={{marginBottom: 26}}
              >
                מערכת קול מצהלות כאן בשבילכם,
                <br />
                <span
                  className="inline-block rounded-[12px]"
                  style={{
                    background: "var(--brand-gold)",
                    color: "var(--brand-gold-foreground)",
                    padding: "1px 16px 5px",
                    transform: "rotate(-1.5deg)",
                  }}
                >
                  הירשמו עכשיו!
                </span>
              </h2>

              <Link
                href={"/auth/sign-up" as any}
                className="inline-flex items-center gap-[9px] rounded-full bg-brand-gold-gradient px-[34px] py-4 text-body font-extrabold text-brand-gold-foreground no-underline shadow-[0_20px_40px_-16px_rgba(0,0,0,.55)] transition-transform hover:-translate-y-0.5"
              >
                הירשמו עכשיו ללא עלות <ArrowIcon />
              </Link>

              <p className="mt-[22px] text-body-sm leading-[1.9] opacity-[.78]">
                הרשמה לפי סוג:{" "}
                <Link href={"/auth/sign-up" as any} className="font-semibold text-brand-gold-soft no-underline hover:text-brand-gold-muted">
                  הורים ומיועדים
                </Link>
                {" · "}
                <Link href={"/auth/sign-up" as any} className="font-semibold text-brand-gold-soft no-underline hover:text-brand-gold-muted">
                  שדכנים ושדכניות
                </Link>
                {" · "}
                <Link href={"/auth/sign-up" as any} className="font-semibold text-brand-gold-soft no-underline hover:text-brand-gold-muted">
                  רבנים וצוותי חינוך
                </Link>
              </p>
            </div>

            {/* Floating cards column — hidden on mobile */}
            <div className="relative hidden min-h-[200px] md:block">
              {/* Card A — top right, rotated -3deg */}
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
                  <CheckIcon />
                </span>
                <div className="text-right">
                  <div className="text-body font-bold text-foreground">הצעה נשלחה</div>
                  <div className="text-caption text-muted-foreground">ממתינה לתגובת הצדדים</div>
                </div>
              </div>

              {/* Card B — bottom left, rotated +3deg */}
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
                  <HeartIcon />
                </span>
                <div className="text-right">
                  <div className="text-body font-bold text-foreground">מזל טוב!</div>
                  <div className="text-caption text-muted-foreground">שידוך נסגר בשעה טובה</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
