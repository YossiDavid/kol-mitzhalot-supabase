/**
 * Auth Layout
 *
 * דפים תחת /auth הם ציבוריים ולא דורשים אימות.
 * עיצוב אחיד: לוגו, כרטיס ממורכז, רקע עדין.
 */

import Image from "next/image";
import Link from "next/link";
import Logo from "@/assets/images/logo.svg";
import Analytics from "@/components/website/google-analytics";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-svh flex-col">
      {/* <div className="from-muted/30 to-background absolute inset-0 -z-10 bg-linear-to-b" /> */}
      <header className="flex shrink-0 items-center justify-center border-b border-border/50 bg-background/80 px-4 py-5 backdrop-blur-sm">
        <Link
          href="/"
          className="flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Image
            src={Logo.src}
            alt="קול מצהלות"
            width={44}
            height={44}
            className="h-11 w-11"
          />
          <span className="text-subtitle font-bold">קול מצהלות</span>
        </Link>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6">
        <div className="w-full max-w-[400px]">{children}</div>
      </main>
      <footer className="shrink-0 border-t border-border/50 bg-background/60 px-4 py-3 text-center text-body-sm text-muted-foreground">
        <Link href="/" className="hover:underline">
          חזרה לאתר
        </Link>
      </footer>
    </div>
  );
}
