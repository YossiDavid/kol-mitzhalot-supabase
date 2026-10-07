"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";

import type { AdminNavSection } from "./admin-nav-items";

type AdminNavSectionMobileProps = {
  section: AdminNavSection;
  activeItemUrl: string | null;
  isCurrent: boolean;
  /** סוגר את התפריט (Sheet) אחרי ניווט */
  onNavigate: () => void;
};

/**
 * אזור בתפריט הניהול במובייל: רשימה מתקפלת במקום חלונית צד (אין hover).
 * האזור הנוכחי פתוח כברירת מחדל.
 */
export function AdminNavSectionMobile({
  section,
  activeItemUrl,
  isCurrent,
  onNavigate,
}: AdminNavSectionMobileProps) {
  const Icon = section.icon;

  return (
    <Collapsible defaultOpen={isCurrent} asChild>
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            isActive={isCurrent}
            data-testid={`admin-nav-section-${section.key}`}
            className="group/collapsible"
          >
            <Icon />
            <span>{section.label}</span>
            <ChevronDown className="ms-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub aria-label={section.label}>
            {section.items.map((item) => (
              <SidebarMenuSubItem key={item.url}>
                <SidebarMenuSubButton
                  asChild
                  isActive={item.url === activeItemUrl}
                  className="h-auto min-h-8 py-1.5 [&>span:last-child]:whitespace-normal"
                >
                  <Link
                    href={item.url}
                    prefetch={false}
                    aria-current={
                      item.url === activeItemUrl ? "page" : undefined
                    }
                    onClick={onNavigate}
                  >
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}
