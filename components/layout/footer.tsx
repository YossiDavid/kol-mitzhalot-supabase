import Link from "next/link";
import { cookies } from "next/headers";
import { cn } from "@/lib/utils";

export default async function Footer({ className }: { className?: string }) {
  // Access cookies first to satisfy Next.js requirement for using new Date()
  await cookies();

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
        כל הזכויות שמורות © {new Date().getFullYear()} | קול מצהלות | אפיון
        וקופי:{" "}
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
