/**
 * Auth Layout
 *
 * דפים תחת /auth הם ציבוריים ולא דורשים אימות.
 * עיצוב אחיד: לוגו, כרטיס ממורכז, רקע עדין.
 */

import Image from "next/image";
import Link from "next/link";
import Logo from "@/assets/images/logo.svg";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-svh flex-col">
      {/* <div className="from-muted/30 to-background absolute inset-0 -z-10 bg-linear-to-b" /> */}
      <header className="border-border/50 bg-background/80 flex shrink-0 items-center justify-center border-b px-4 py-5 backdrop-blur-sm">
        <Link
          href="/"
          className="focus-visible:ring-ring flex items-center gap-2 focus:outline-none focus-visible:ring-2"
        >
          <Image
            src={Logo.src}
            alt="קול מצהלות"
            width={44}
            height={44}
            className="h-11 w-11"
          />
          <span className="text-lg font-bold">קול מצהלות</span>
        </Link>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6">
        <div className="w-full max-w-[400px]">{children}</div>
      </main>
      <footer className="border-border/50 bg-background/60 text-muted-foreground shrink-0 border-t px-4 py-3 text-center text-sm">
        <Link href="/" className="hover:underline">
          חזרה לאתר
        </Link>
      </footer>
    </div>
  );
}
