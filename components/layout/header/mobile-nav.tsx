"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const NAV_LINKS = [
  { label: "בית", href: "/" },
  { label: "אודות", href: "/about" },
  { label: "מרכז הידע", href: "/knowledge" },
  { label: "מה חדש", href: "/whats-new" },
  { label: "קול מצהלות לשדכנים", href: "/shadchanim" },
  { label: "קול מצהלות להורים ומיועדים", href: "/parents" },
  { label: "צרו קשר", href: "/contact" },
];

export function WebMobileNav({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="xl:hidden"
          aria-label="תפריט"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex flex-col p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>תפריט</SheetTitle>
          <SheetDescription>ניווט האתר וכניסה למערכת</SheetDescription>
        </SheetHeader>
        <nav className="flex-1 overflow-y-auto px-3 pt-14 pb-2">
          <ul className="m-0 flex list-none flex-col p-0">
            {NAV_LINKS.map(({ label, href }) => (
              <li key={href}>
                <SheetClose asChild>
                  <Link
                    href={href as any}
                    className="block rounded-md px-3 py-3 text-body font-medium text-foreground no-underline transition-colors hover:bg-primary-muted hover:text-primary"
                  >
                    {label}
                  </Link>
                </SheetClose>
              </li>
            ))}
          </ul>
        </nav>
        <SheetFooter className="border-t border-border">
          {/* משתמש מחובר חוזר למערכת, ולא מופנה שוב לכניסה */}
          {isLoggedIn ? (
            <Button asChild>
              <Link href="/app" onClick={close}>
                לאזור האישי
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost">
                <Link href={"/auth/login" as any} onClick={close}>
                  כניסה
                </Link>
              </Button>
              <Button asChild>
                <Link href={"/auth/sign-up" as any} onClick={close}>
                  הרשמה חינם
                </Link>
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
