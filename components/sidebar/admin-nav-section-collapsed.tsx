"use client";

import { useState } from "react";
import Link from "next/link";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

import type { AdminNavSection } from "./admin-nav-items";

const PANEL_SIDE_OFFSET = 6;

type AdminNavSectionCollapsedProps = {
  section: AdminNavSection;
  /** כתובת תת-העמוד הפעיל, או null */
  activeItemUrl: string | null;
  /** האזור מכיל את העמוד הנוכחי */
  isCurrent: boolean;
};

/**
 * אזור בתפריט הניהול בסרגל מכווץ (אייקונים בלבד): מעבר עכבר מציג רק
 * tooltip עם שם האזור; לחיצה פותחת חלונית עם תתי העמודים. החלונית נסגרת
 * ב-Escape, בלחיצה בחוץ ובבחירת קישור. אין פתיחה במעבר עכבר או בפוקוס.
 */
export function AdminNavSectionCollapsed({
  section,
  activeItemUrl,
  isCurrent,
}: AdminNavSectionCollapsedProps) {
  const [isOpen, setIsOpen] = useState(false);
  const Icon = section.icon;

  return (
    <SidebarMenuItem>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <SidebarMenuButton
            isActive={isCurrent}
            tooltip={section.label}
            data-testid={`admin-nav-section-${section.key}`}
            className={cn(isCurrent && "font-bold")}
          >
            <Icon />
            <span>{section.label}</span>
          </SidebarMenuButton>
        </PopoverTrigger>
        <PopoverContent
          data-testid={`admin-flyout-${section.key}`}
          side="left"
          align="start"
          sideOffset={PANEL_SIDE_OFFSET}
          className="w-64 p-1.5"
        >
          <nav aria-label={section.label}>
            <p className="px-2 pb-1 text-caption font-bold text-muted-foreground">
              {section.label}
            </p>
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const isActive = item.url === activeItemUrl;
                return (
                  <li key={item.url}>
                    <Link
                      href={item.url}
                      prefetch={false}
                      aria-current={isActive ? "page" : undefined}
                      onClick={() => setIsOpen(false)}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-body-sm outline-hidden hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring",
                        isActive &&
                          "bg-accent font-bold text-accent-foreground",
                      )}
                    >
                      <item.icon className="size-4 shrink-0 text-muted-foreground" />
                      <span>{item.title}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </PopoverContent>
      </Popover>
    </SidebarMenuItem>
  );
}
