"use client";
import { useState } from "react";
import Link from "next/link";

const NAV_LINKS = [
  { label: "בית", href: "/" },
  { label: "אודות", href: "/about" },
  { label: "מרכז הידע", href: "/knowledge" },
  { label: "מה חדש", href: "/whats-new" },
  { label: "קול מצהלות לשדכנים", href: "/shadchanim" },
  { label: "קול מצהלות להורים ומיועדים", href: "/parents" },
  { label: "צרו קשר", href: "/contact" },
];

export function WebMobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="flex items-center justify-center rounded-[8px] p-2 text-primary transition-colors hover:bg-primary/8 lg:hidden"
        onClick={() => setOpen(!open)}
        aria-label="תפריט"
        aria-expanded={open}
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18" /><path d="m6 6 12 12" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      <div
          className={`absolute inset-x-0 top-[69px] z-50 border-b border-primary/13 px-6 py-4 shadow-lg lg:hidden transition-all duration-200 ease-out${open ? " opacity-100 translate-y-0 pointer-events-auto" : " opacity-0 -translate-y-2 pointer-events-none"}`}
          style={{ background: "rgba(236,240,242,.97)", backdropFilter: "saturate(180%) blur(10px)" }}
        >
          <ul className="m-0 flex list-none flex-col gap-0 p-0">
            {NAV_LINKS.map(({ label, href }) => (
              <li key={href}>
                <Link
                  href={href as any}
                  className="block border-b border-primary/7 py-3 text-body font-medium text-muted-foreground no-underline transition-colors last:border-b-0 hover:text-foreground"
                  onClick={() => setOpen(false)}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex gap-3">
            <Link
              href={"/auth/login" as any}
              className="flex-1 rounded-full border border-border px-4 py-2 text-center text-body-sm font-semibold text-primary no-underline"
              onClick={() => setOpen(false)}
            >
              כניסה
            </Link>
            <Link
              href={"/auth/sign-up" as any}
              className="flex-1 rounded-full bg-primary px-4 py-2 text-center text-body-sm font-bold text-primary-foreground no-underline"
              onClick={() => setOpen(false)}
            >
              הרשמה חינם
            </Link>
          </div>
        </div>
    </>
  );
}
