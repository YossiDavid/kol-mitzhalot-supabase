"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, MessageCircle, Network, Plus, Settings, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/user-role";

const allItems = [
  { title: "ראשי", url: "/app", icon: Home },
  { title: "מיועדים", url: "/app/students", icon: Users },
  { title: "הוספת מיועד", url: "/app/students/create", icon: Plus },
  { title: "צ'אטים", url: "/app/chats", icon: MessageCircle },
  { title: "לוח עבודה", url: "/app/canvas", icon: Network },
  { title: "הגדרות", url: "/app/settings", icon: Settings },
] as const;

const shadchanOnlyUrls = ["/app/students", "/app/students/create", "/app/canvas"];

export function BottomNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const effectiveRole: Role = mounted ? role : "user";
  const isShadchanOrAdmin = effectiveRole === "shadchan" || effectiveRole === "admin";
  const items = isShadchanOrAdmin
    ? allItems
    : allItems.filter((item) => !shadchanOnlyUrls.includes(item.url));

  return (
    <nav className="fixed bottom-0 right-0 left-0 z-50 border-t bg-background md:hidden">
      <div className="flex h-16 items-stretch justify-around">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.url;
          return (
            <Link
              key={item.url}
              href={item.url}
              prefetch={false}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 text-xs transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon
                className={cn("h-5 w-5", isActive && "stroke-[2.5]")}
              />
              <span className="leading-none">{item.title}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
