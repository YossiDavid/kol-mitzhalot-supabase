"use client";

import Link from "next/link";
import { GraduationCap, HeartHandshake, Globe, LogOut } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";

import { SidebarLogo } from "./sidebar/logo";
import { SITE_CONTENT_LINKS } from "./layout/site-content-links";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/lib/user-role";
import { useUnreadChats } from "@/features/chats/lib/unread-chats-context";
import { SidebarNavGroup } from "./sidebar/nav-group";
import { navGroupsFor } from "./sidebar/nav-items";
import { AdminSidebarNav } from "./sidebar/admin-nav";
import { isAdminPath } from "./sidebar/admin-nav-items";

export function AppSidebar({
  roles,
  highlightShadchanJoin = false,
}: {
  roles: Role[];
  /** נרשם כדי להיות שדכן: "הצטרפות כשדכן" מודגש וקרוב לניווט הראשי */
  highlightShadchanJoin?: boolean;
}) {
  const { state, isMobile, setOpenMobile } = useSidebar();
  // ב-Sheet של המובייל תמיד מוצגים תוויות מלאות, גם כשהסרגל בדסקטופ מכווץ
  const isCollapsed = state === "collapsed" && !isMobile;
  const pathname = usePathname();
  const router = useRouter();
  const { count: unreadChatsCount } = useUnreadChats();

  const effectiveRoles: Role[] = roles;
  // ניווט חייב להציג את איחוד כל ההרשאות של המשתמש - מי שהוא גם שדכן וגם
  // איש צוות עדיין רואה את פריטי השדכן, ולא רק לפי תפקיד "ראשי" יחיד.
  const isShadchanOrAdmin =
    effectiveRoles.includes("shadchan") || effectiveRoles.includes("admin");
  // אותם תנאים כמו בתפריט המשתמש שבהדר: מציעים הצטרפות רק למי שעדיין
  // אין לו את התפקיד בפועל.
  const showShadchanJoin = !isShadchanOrAdmin;
  const showStaffJoin =
    !effectiveRoles.includes("staff") && !effectiveRoles.includes("admin");

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  /** במצב מכווץ מוצג רק אייקון, ולכן הטקסט עובר ל-tooltip. */
  const withTooltip = (node: React.ReactNode, label: string) =>
    isCollapsed ? (
      <Tooltip>
        <TooltipTrigger asChild>{node}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    ) : (
      node
    );

  const navGroups = navGroupsFor(effectiveRoles);
  // בתוך /app/admin מוצג תפריט הניהול במקום הניווט הרגיל - רק למנהל
  // (שער הנתיב ב-admin/layout.tsx נשאר ההגנה האמיתית).
  const isAdminMode = isAdminPath(pathname) && effectiveRoles.includes("admin");

  return (
    <Sidebar
      variant="floating"
      side="right"
      collapsible="icon"
      className="hidden md:flex"
    >
      <SidebarLogo />

      <SidebarContent>
        {isAdminMode ? (
          <AdminSidebarNav
            pathname={pathname}
            isCollapsed={isCollapsed}
            isMobile={isMobile}
            onNavigate={() => setOpenMobile(false)}
          />
        ) : (
          <>
            {navGroups.map((group) => (
              <SidebarNavGroup
                key={group.key}
                group={group}
                pathname={pathname}
                isCollapsed={isCollapsed}
                unreadChatsCount={unreadChatsCount}
              />
            ))}

            {/* תוכן האתר הכללי - אחרת משתמש מחובר מגיע אליו רק דרך הפוטר */}
            <SidebarGroup>
              <SidebarGroupLabel>מידע ותוכן</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {SITE_CONTENT_LINKS.map(({ title, href, icon: Icon }) => (
                    <SidebarMenuItem key={href}>
                      {withTooltip(
                        <SidebarMenuButton asChild>
                          <Link href={href} prefetch={false}>
                            <Icon />
                            <span>{title}</span>
                          </Link>
                        </SidebarMenuButton>,
                        title,
                      )}
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {/* יציאה מהמערכת לאתר הציבורי */}
          <SidebarMenuItem>
            {withTooltip(
              <SidebarMenuButton asChild>
                <Link href="/" prefetch={false} data-testid="sidebar-site-link">
                  <Globe />
                  <span>לאתר קול מצהלות</span>
                </Link>
              </SidebarMenuButton>,
              "לאתר קול מצהלות",
            )}
          </SidebarMenuItem>

          {showShadchanJoin && (
            <SidebarMenuItem>
              {withTooltip(
                <SidebarMenuButton
                  asChild
                  className={
                    highlightShadchanJoin
                      ? "bg-primary/10 font-bold text-primary hover:bg-primary/15 hover:text-primary"
                      : undefined
                  }
                >
                  <Link
                    href="/app/settings/shadchan"
                    prefetch={false}
                    data-testid="sidebar-shadchan-join"
                  >
                    <HeartHandshake />
                    <span>הצטרפות כשדכן</span>
                  </Link>
                </SidebarMenuButton>,
                "הצטרפות כשדכן",
              )}
            </SidebarMenuItem>
          )}

          {showStaffJoin && (
            <SidebarMenuItem>
              {withTooltip(
                <SidebarMenuButton asChild>
                  <Link href="/app/settings/staff" prefetch={false}>
                    <GraduationCap />
                    <span>הצטרפות כאיש צוות</span>
                  </Link>
                </SidebarMenuButton>,
                "הצטרפות כאיש צוות",
              )}
            </SidebarMenuItem>
          )}

          {(showShadchanJoin || showStaffJoin) && <SidebarSeparator />}

          <SidebarMenuItem>
            {withTooltip(
              <SidebarMenuButton
                onClick={() => void logout()}
                className="hover:bg-sidebar-destructive/15 hover:text-sidebar-destructive"
              >
                <LogOut />
                <span>התנתקות</span>
              </SidebarMenuButton>,
              "התנתקות",
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
