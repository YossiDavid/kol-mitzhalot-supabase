import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t-foreground/10 container flex min-h-16 items-center justify-between border-t">
      <nav>
        <ul className="flex gap-4">
          <li>
            <Link href="/pricing">מסלולים</Link>
          </li>
          <li>
            <Link href="/terms-of-use">תנאי שימוש</Link>
          </li>
          <li>
            <Link href="/privacy-policy">פרטיות</Link>
          </li>
          <li>
            <Link href="/accessibility">הצהרת נגישות</Link>
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
