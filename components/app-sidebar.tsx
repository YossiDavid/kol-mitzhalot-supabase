"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ClipboardList,
  GraduationCap,
  HeartHandshake,
  Home,
  LogOut,
  MessageCircle,
  Network,
  Plus,
  Settings,
  Users,
} from "lucide-react";

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
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/lib/user-role";

const allItems = [
  { title: "ראשי", url: "/app", icon: Home },
  { title: "מיועדים", url: "/app/students", icon: Users },
  { title: "הוספת מיועד", url: "/app/students/create", icon: Plus },
  { title: "צ'אטים", url: "/app/chats", icon: MessageCircle },
  { title: "לוח העבודה", url: "/app/canvas", icon: Network },
  {
    title: "כל השידוכים שלי",
    url: "/app/shadchan/proposals",
    icon: ClipboardList,
  },
  { title: "הגדרות", url: "/app/settings", icon: Settings },
] as const;

// לוח ההתאמות הוא כלי עבודה של שדכן/מנהל בלבד.
const shadchanOnlyUrls = ["/app/canvas", "/app/shadchan/proposals"];
// רשימת המיועדים חושפת מיועדים של אחרים, ולכן סגורה להורה. "הוספת
// מיועד" נשארת פתוחה לכולם — הורה מוסיף את ילדיו.
const staffVisibleUrls = ["/app/students"];

export function AppSidebar({ roles }: { roles: Role[] }) {
  const [mounted, setMounted] = useState(false);
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => setMounted(true), []);

  // Use roles only after mount so server and client initial render match (avoid hydration mismatch)
  const effectiveRoles: Role[] = mounted ? roles : ["user"];
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

  const items = allItems.filter((item) => {
    if (shadchanOnlyUrls.includes(item.url)) return isShadchanOrAdmin
    if (staffVisibleUrls.includes(item.url))
      return isShadchanOrAdmin || effectiveRoles.includes("staff");
    return true;
  });
  return (
    <Sidebar
      variant="floating"
      side="right"
      collapsible="icon"
      className="hidden md:flex"
    >
      <SidebarLogo />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            {isShadchanOrAdmin ? "שדכנים" : "ניווט"}
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const Icon = item.icon;

                const button = (
                  <SidebarMenuButton asChild isActive={pathname === item.url}>
                    <Link href={item.url} prefetch={false}>
                      <Icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                );

                return (
                  <SidebarMenuItem key={item.title}>
                    {isCollapsed ? (
                      <Tooltip>
                        <TooltipTrigger asChild>{button}</TooltipTrigger>
                        <TooltipContent side="right">
                          {item.title}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      button
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {showShadchanJoin && (
            <SidebarMenuItem>
              {withTooltip(
                <SidebarMenuButton asChild>
                  <Link href="/app/settings/shadchan" prefetch={false}>
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
                className="text-sidebar-destructive hover:bg-sidebar-destructive/15 hover:text-sidebar-destructive"
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
