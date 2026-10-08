"use client";

import { useState } from "react";
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

type AdminNavSectionAccordionProps = {
  section: AdminNavSection;
  activeItemUrl: string | null;
  isCurrent: boolean;
  /** סוגר את התפריט (Sheet) אחרי ניווט - במובייל בלבד */
  onNavigate?: () => void;
};

/**
 * אזור בתפריט הניהול כרשימה מתקפלת בתוך הסרגל (סרגל מורחב ומגירת המובייל).
 * הלחיצה על הכותרת רק פותחת וסוגרת - לא מנווטת, ושום דבר לא נפתח במעבר
 * עכבר או בפוקוס. כמה אזורים יכולים להיות פתוחים יחד; האזור שמכיל את העמוד
 * הנוכחי פתוח כברירת מחדל, ונפתח גם כשמנווטים אליו מבחוץ.
 */
export function AdminNavSectionAccordion({
  section,
  activeItemUrl,
  isCurrent,
  onNavigate,
}: AdminNavSectionAccordionProps) {
  const [isOpen, setIsOpen] = useState(isCurrent);
  const [wasCurrent, setWasCurrent] = useState(isCurrent);
  // ניווט לאזור הזה פותח אותו; יציאה ממנו לא סוגרת (נשאר כפי שהמשתמש השאיר)
  if (isCurrent !== wasCurrent) {
    setWasCurrent(isCurrent);
    if (isCurrent) setIsOpen(true);
  }
  const Icon = section.icon;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} asChild>
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
