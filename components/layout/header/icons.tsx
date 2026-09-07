"use client";

import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import { Crown, Home, Settings } from "lucide-react";
import Link from "next/link";
import { NotificationBell } from "@/features/notifications/components/notification-bell";

interface HeaderIconsProps {
  /** כשמוצג תפריט משתמש (אייקון משתמש) – לא להציג אייקון הגדרות נפרד */
  hasUserMenu?: boolean;
  /** מזהה המשתמש המחובר. בלעדיו אין למי להציג התראות. */
  userId?: string | null;
}

export default function HeaderIcons({
  hasUserMenu = false,
  userId = null,
}: HeaderIconsProps) {
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => {
          console.log("Clicked favorite button");
        }}
      >
        <Crown className="fill-current text-favorite" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        asChild
        className="hidden md:inline-flex"
      >
        <Link href={"/app"}>
          <Home />
        </Link>
      </Button>

      {userId && <NotificationBell userId={userId} />}

      {!hasUserMenu && (
        <Button variant="ghost" size="icon" asChild>
          <Link href={"/app/settings"}>
            <Settings />
          </Link>
        </Button>
      )}

      <ThemeSwitcher />
    </div>
  );
}
