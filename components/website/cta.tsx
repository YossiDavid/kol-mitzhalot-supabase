import Link from "next/link";
import { LogoSvg } from "@/components/website/logo-svg";

function CheckIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2b5a5c" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c79a2f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
    <section className="bg-[#ecf0f2]">
      <div className="mx-auto max-w-[1160px] px-6 pb-[72px] pt-6">
        <div
          className="relative overflow-hidden rounded-[30px] text-[#f4f8f7]"
          style={{
            background: "linear-gradient(135deg,#2f6264 0%,#123c3b 76%)",
            boxShadow: "0 46px 90px -46px rgba(12,45,43,.7)",
          }}
        >
          {/* Gold radial overlay */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(120% 95% at 90% 8%,rgba(231,200,120,.2),transparent 52%)" }}
          />
          {/* Brand SVG watermark */}
          <LogoSvg
            size={500}
            className="pointer-events-none absolute text-[rgba(231,200,120,.07)]"
            style={{ bottom: -160, left: -90 } as React.CSSProperties}
          />

          {/* Inner grid */}
          <div className="relative grid items-center gap-8 p-14" style={{ gridTemplateColumns: "1.15fr .85fr" }}>
            {/* Text column */}
            <div>
              <h2
                className="font-bold leading-[1.14] text-[#f4f8f7]"
                style={{ fontSize: "clamp(30px,3.8vw,46px)", marginBottom: 26 }}
              >
                מערכת קול מצהלות כאן בשבילכם,
                <br />
                <span
                  className="inline-block rounded-[12px]"
                  style={{
                    background: "#e7c877",
                    color: "#123331",
                    padding: "1px 16px 5px",
                    transform: "rotate(-1.5deg)",
                  }}
                >
                  הירשמו עכשיו!
                </span>
              </h2>

              <Link
                href={"/auth/sign-up" as any}
                className="inline-flex items-center gap-[9px] rounded-full no-underline transition-transform hover:-translate-y-0.5"
                style={{
                  background: "linear-gradient(145deg,#f2dc8f,#dcb149)",
                  color: "#123331",
                  padding: "16px 34px",
                  fontSize: 17,
                  fontWeight: 800,
                  boxShadow: "0 20px 40px -16px rgba(0,0,0,.55)",
                }}
              >
                הירשמו עכשיו ללא עלות <ArrowIcon />
              </Link>

              <p className="mt-[22px] text-[13.5px] leading-[1.9] opacity-[.78]">
                הרשמה לפי סוג:{" "}
                <Link href={"/auth/sign-up" as any} className="font-semibold text-[#eecf83] no-underline hover:text-[#f4e4b3]">
                  הורים ומיועדים
                </Link>
                {" · "}
                <Link href={"/auth/sign-up" as any} className="font-semibold text-[#eecf83] no-underline hover:text-[#f4e4b3]">
                  שדכנים ושדכניות
                </Link>
                {" · "}
                <Link href={"/auth/sign-up" as any} className="font-semibold text-[#eecf83] no-underline hover:text-[#f4e4b3]">
                  רבנים וצוותי חינוך
                </Link>
              </p>
            </div>

            {/* Floating cards column */}
            <div className="relative min-h-[200px]">
              {/* Card A — top right, rotated -3deg */}
              <div
                className="absolute flex items-center gap-[13px] rounded-2xl bg-white"
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
                <span
                  className="flex shrink-0 items-center justify-center rounded-[12px]"
                  style={{ width: 42, height: 42, background: "rgba(43,90,92,.1)" }}
                >
                  <CheckIcon />
                </span>
                <div className="text-right">
                  <div className="text-[15px] font-bold text-[#1b2523]">הצעה נשלחה</div>
                  <div className="text-[12.5px] text-[#66716f]">ממתינה לתגובת הצדדים</div>
                </div>
              </div>

              {/* Card B — bottom left, rotated +3deg */}
              <div
                className="absolute flex items-center gap-[13px] rounded-2xl bg-white"
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
                <span
                  className="flex shrink-0 items-center justify-center rounded-[12px]"
                  style={{ width: 42, height: 42, background: "rgba(220,177,73,.18)" }}
                >
                  <HeartIcon />
                </span>
                <div className="text-right">
                  <div className="text-[15px] font-bold text-[#1b2523]">מזל טוב!</div>
                  <div className="text-[12.5px] text-[#66716f]">שידוך נסגר בשעה טובה</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
