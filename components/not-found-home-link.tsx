"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";

const APP_ROOT = "/app";

/**
 * קישור החזרה בדף 404: מי שהגיע מכתובת באפליקציה (/app/...) חוזר לעמוד
 * הראשי שלה (משם מועבר להתחברות אם אינו מחובר); כתובת באתר הציבורי חוזרת
 * לדף הבית. הדף עצמו אינו יודע אם הגולש מחובר.
 */
export function NotFoundHomeLink() {
  const pathname = usePathname();
  const isInsideApp =
    pathname === APP_ROOT || pathname.startsWith(`${APP_ROOT}/`);

  return (
    <Button asChild>
      <Link href={isInsideApp ? APP_ROOT : "/"}>
        {isInsideApp ? "חזרה לעמוד הראשי" : "חזרה לדף הבית"}
      </Link>
    </Button>
  );
}
