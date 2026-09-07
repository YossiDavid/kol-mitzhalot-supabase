import Link from "next/link";
import { Lock } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * הורה שמנסה להגיע לרשימת המיועדים. הרשימה חושפת מיועדים של אחרים
 * ולכן סגורה לו — אבל הפניה שקטה ל-/app נראית כמו תקלה, ולכן מוסבר
 * מה קרה ולאן כן אפשר להמשיך.
 */
export function StudentsNoAccess() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <div
        className="flex size-12 items-center justify-center rounded-full bg-muted"
        aria-hidden="true"
      >
        <Lock className="size-6 text-muted-foreground" strokeWidth={1.5} />
      </div>
      <div className="space-y-1">
        <h1 className="text-body font-semibold text-foreground">
          אין לך הרשאה לצפות בתוכן זה
        </h1>
        <p className="mx-auto max-w-[38ch] text-body-sm text-muted-foreground">
          רשימת המיועדים פתוחה לשדכנים, לאנשי צוות ולמנהלים בלבד. את הכרטיסים של
          ילדיך אפשר לראות בעמוד הראשי.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button asChild>
          <Link href="/app">לעמוד הראשי</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/app/students/create">להוספת בן / בת</Link>
        </Button>
      </div>
    </div>
  );
}
