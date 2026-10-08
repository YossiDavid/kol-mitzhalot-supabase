"use client";

import { ArrowRight, LayoutDashboard } from "lucide-react";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
} from "@/components/ui/sidebar";

import { AdminNavSectionAccordion } from "./admin-nav-section-accordion";
import { AdminNavSectionCollapsed } from "./admin-nav-section-collapsed";
import {
  ADMIN_HOME_URL,
  ADMIN_NAV_SECTIONS,
  APP_HOME_URL,
  activeAdminItemUrl,
  activeAdminSectionKey,
} from "./admin-nav-items";
import { NavItemLink } from "./nav-group";
import type { NavItem } from "./nav-items";

const BACK_ITEM: NavItem = {
  title: "חזרה למערכת",
  url: APP_HOME_URL,
  icon: ArrowRight,
  group: "general",
};

const HOME_ITEM: NavItem = {
  title: "לוח הבקרה",
  url: ADMIN_HOME_URL,
  icon: LayoutDashboard,
  group: "general",
};

type AdminSidebarNavProps = {
  pathname: string;
  isCollapsed: boolean;
  /** בתוך ה-Sheet של המובייל: סגירה אחרי ניווט (תמיד רשימות מתקפלות) */
  isMobile?: boolean;
  onNavigate?: () => void;
};

/**
 * תפריט הניהול של הסיידבר (במקום הניווט הרגיל בתוך /app/admin): חזרה
 * למערכת, דף הבית של הניהול, ואזורים עם תתי עמודים - רשימות מתקפלות
 * בסרגל מורחב ובמובייל, וחלונית בלחיצה בסרגל מכווץ.
 */
export function AdminSidebarNav({
  pathname,
  isCollapsed,
  isMobile = false,
  onNavigate = () => {},
}: AdminSidebarNavProps) {
  const activeItemUrl = activeAdminItemUrl(pathname);
  const currentSectionKey = activeAdminSectionKey(pathname);

  return (
    <SidebarGroup data-testid="admin-sidebar-nav">
      <SidebarGroupContent>
        <SidebarMenu>
          <NavItemLink
            item={BACK_ITEM}
            isActive={false}
            isCollapsed={isCollapsed}
            unreadChatsCount={0}
            testId="admin-sidebar-back"
            onNavigate={onNavigate}
            className="font-bold text-primary"
          />
          <NavItemLink
            item={HOME_ITEM}
            isActive={pathname === ADMIN_HOME_URL}
            isCollapsed={isCollapsed}
            unreadChatsCount={0}
            testId="admin-sidebar-home"
            onNavigate={onNavigate}
          />
          {ADMIN_NAV_SECTIONS.map((section) =>
            isCollapsed && !isMobile ? (
              <AdminNavSectionCollapsed
                key={section.key}
                section={section}
                activeItemUrl={activeItemUrl}
                isCurrent={section.key === currentSectionKey}
              />
            ) : (
              <AdminNavSectionAccordion
                key={section.key}
                section={section}
                activeItemUrl={activeItemUrl}
                isCurrent={section.key === currentSectionKey}
                onNavigate={isMobile ? onNavigate : undefined}
              />
            ),
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
