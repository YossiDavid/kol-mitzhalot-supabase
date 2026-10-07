import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import type { Route } from "next";

import { Button } from "@/components/ui/button";
import { getUser } from "@/lib/user";
import { resolveDisplayName } from "@/lib/user-display-name";

type QuickAction = { label: string; href: Route; isPrimary?: boolean };

/** המשימות השכיחות ביותר של מנהל */
const QUICK_ACTIONS: readonly QuickAction[] = [
  { label: "יצירת משתמש", href: "/app/admin/users/create", isPrimary: true },
  { label: "מאמר חדש", href: "/app/admin/content/articles/new" as Route },
  { label: "דוח הצעות", href: "/app/admin/proposals" },
  { label: "הגדרות מערכת", href: "/app/admin/settings" },
];

/** פאנל הפתיחה של לוח הבקרה: ברכה, הכוונה ופעולות מהירות */
export async function DashboardWelcome() {
  noStore();
  const user = await getUser();
  const firstName = user ? resolveDisplayName(user, null).firstName : null;

  return (
    <section
      aria-labelledby="admin-welcome-title"
      className="space-y-4 rounded-lg border bg-card p-5 md:p-6"
    >
      <div className="space-y-1">
        <h2 id="admin-welcome-title" className="text-title font-bold">
          {firstName ? `שלום ${firstName}, ` : ""}ברוך הבא למערכת הניהול של קול
          מצהלות
        </h2>
        <p className="text-body text-muted-foreground">
          כאן רואים מה מחכה לטיפולך, ומשם עוברים לכל אזורי הניהול דרך התפריט
          בצד.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map(({ label, href, isPrimary }) => (
          <Button
            key={href}
            asChild
            variant={isPrimary ? "default" : "outline"}
          >
            <Link href={href}>{label}</Link>
          </Button>
        ))}
      </div>
    </section>
  );
}

export function DashboardWelcomeSkeleton() {
  return (
    <div
      aria-hidden
      className="h-36 animate-pulse rounded-lg bg-primary-muted"
    />
  );
}
