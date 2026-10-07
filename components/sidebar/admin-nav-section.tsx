"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

import {
  adminSectionLandingUrl,
  type AdminNavSection,
} from "./admin-nav-items";

/** השהיה לפני סגירה, כדי שהסמן יוכל לעבור מהפריט אל החלונית בלי שתיעלם */
const FLYOUT_CLOSE_DELAY_MS = 150;
const FLYOUT_SIDE_OFFSET = 6;
const FLYOUT_ATTR = "data-admin-flyout";

type AdminNavSectionProps = {
  section: AdminNavSection;
  /** כתובת תת-העמוד הפעיל, או null */
  activeItemUrl: string | null;
  /** האזור מכיל את העמוד הנוכחי */
  isCurrent: boolean;
  isCollapsed: boolean;
};

type PointerKind = "mouse" | "touch" | "keyboard";

/**
 * פריט עליון בתפריט הניהול, בסגנון וורדפרס: האזור הנוכחי נפתח בתוך הסרגל;
 * שאר האזורים (וכל האזורים בסרגל מכווץ) נפתחים כחלונית צד במעבר עכבר או
 * במקלדת, ובנגיעה ראשונה במסך מגע. לחיצה על הפריט מובילה לתת-העמוד הראשון.
 */
export function AdminNavSectionItem({
  section,
  activeItemUrl,
  isCurrent,
  isCollapsed,
}: AdminNavSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const pointerKind = useRef<PointerKind>("mouse");
  const shouldFocusFirst = useRef(false);

  const triggerId = `admin-nav-${section.key}`;
  const isInline = isCurrent && !isCollapsed;
  const Icon = section.icon;

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };

  const openNow = () => {
    cancelClose();
    setIsOpen(true);
  };

  const closeNow = () => {
    cancelClose();
    setIsOpen(false);
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(
      () => setIsOpen(false),
      FLYOUT_CLOSE_DELAY_MS,
    );
  };

  const focusTrigger = () => document.getElementById(triggerId)?.focus();

  const focusFirstItem = () => {
    if (isOpen) {
      contentRef.current?.querySelector("a")?.focus();
      return;
    }
    shouldFocusFirst.current = true;
    openNow();
  };

  const focusSibling = (step: 1 | -1) => {
    const links = Array.from(
      contentRef.current?.querySelectorAll<HTMLElement>("a") ?? [],
    );
    const index = links.findIndex((link) => link === document.activeElement);
    const next = links[(index + step + links.length) % links.length];
    next?.focus();
  };

  const trigger = (
    <SidebarMenuButton
      asChild
      isActive={isCurrent}
      className={cn(isCurrent && "font-bold")}
    >
      <Link
        id={triggerId}
        href={adminSectionLandingUrl(section)}
        prefetch={false}
        data-testid={`admin-nav-section-${section.key}`}
        aria-haspopup={isInline ? undefined : "true"}
        aria-expanded={isInline ? true : isOpen}
        aria-controls={isInline ? `${triggerId}-sub` : undefined}
        onPointerDown={(e) => {
          pointerKind.current = e.pointerType === "touch" ? "touch" : "mouse";
        }}
        onPointerEnter={(e) => {
          if (!isInline && e.pointerType === "mouse") openNow();
        }}
        onPointerLeave={(e) => {
          if (!isInline && e.pointerType === "mouse") scheduleClose();
        }}
        onFocus={(e) => {
          // רק פוקוס מקלדת (לא לחיצת עכבר) פותח את החלונית
          if (!isInline && e.currentTarget.matches(":focus-visible")) openNow();
        }}
        onBlur={(e) => {
          const next = e.relatedTarget as Element | null;
          if (!next?.closest(`[${FLYOUT_ATTR}="${section.key}"]`)) {
            scheduleClose();
          }
        }}
        onKeyDown={(e) => {
          pointerKind.current = "keyboard";
          if (isInline) return;
          if (e.key === "Escape") closeNow();
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
            e.preventDefault();
            focusFirstItem();
          }
        }}
        onClick={(e) => {
          if (isInline) return;
          // מסך מגע: הנגיעה הראשונה פותחת את התפריט, השנייה מנווטת
          if (pointerKind.current === "touch" && !isOpen) {
            e.preventDefault();
            openNow();
            return;
          }
          closeNow();
        }}
      >
        <Icon />
        <span>{section.label}</span>
        {!isInline && (
          <ChevronLeft className="ms-auto size-4 opacity-60 group-data-[collapsible=icon]:hidden" />
        )}
      </Link>
    </SidebarMenuButton>
  );

  return (
    <SidebarMenuItem>
      <Popover open={isOpen && !isInline} onOpenChange={setIsOpen}>
        <PopoverAnchor asChild>{trigger}</PopoverAnchor>

        {isInline ? (
          <SidebarMenuSub id={`${triggerId}-sub`} aria-label={section.label}>
            {section.items.map((item) => (
              <SidebarMenuSubItem key={item.url}>
                <SidebarMenuSubButton
                  asChild
                  isActive={item.url === activeItemUrl}
                  className="h-auto min-h-7 py-1 [&>span:last-child]:whitespace-normal"
                >
                  <Link
                    href={item.url}
                    prefetch={false}
                    aria-current={
                      item.url === activeItemUrl ? "page" : undefined
                    }
                  >
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        ) : (
          <PopoverContent
            ref={contentRef}
            {...{ [FLYOUT_ATTR]: section.key }}
            data-testid={`admin-flyout-${section.key}`}
            side="left"
            align="start"
            sideOffset={FLYOUT_SIDE_OFFSET}
            className="w-64 p-1.5"
            onOpenAutoFocus={(e) => {
              // בפתיחה בעכבר/מגע הפוקוס נשאר על הפריט; במקלדת עובר לתת-עמוד
              e.preventDefault();
              if (shouldFocusFirst.current) {
                shouldFocusFirst.current = false;
                contentRef.current?.querySelector("a")?.focus();
              }
            }}
            onCloseAutoFocus={(e) => e.preventDefault()}
            onInteractOutside={(e) => {
              const target = e.target as Element | null;
              if (target?.closest(`#${triggerId}`)) e.preventDefault();
            }}
            onEscapeKeyDown={focusTrigger}
            onPointerEnter={cancelClose}
            onPointerLeave={scheduleClose}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                focusSibling(1);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                focusSibling(-1);
              } else if (e.key === "ArrowRight") {
                e.preventDefault();
                focusTrigger();
              }
            }}
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
                        onClick={closeNow}
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
        )}
      </Popover>
    </SidebarMenuItem>
  );
}
