"use client";

import Link from "next/link";
import {
  BookmarkCheck,
  ClipboardList,
  GraduationCap,
  HeartHandshake,
  Home,
  Inbox,
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
import { SITE_CONTENT_LINKS } from "./layout/site-content-links";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/lib/user-role";
import { UnreadChatsBadge } from "@/features/chats/components/unread-chats-badge";
import { useUnreadChats } from "@/features/chats/lib/unread-chats-context";
import { unreadChatsLabel } from "@/features/chats/lib/unread-rooms";

const CHATS_URL = "/app/chats";

const allItems = [
  { title: "ראשי", url: "/app", icon: Home },
  { title: "מיועדים", url: "/app/students", icon: Users },
  { title: "הוספת מיועד", url: "/app/students/create", icon: Plus },
  { title: "צ'אטים", url: "/app/chats", icon: MessageCircle },
  // הצעות שנשלחו לילדי המשתמש - לכל משתמש, גם שדכן יכול להיות הורה
  { title: "הצעות שקיבלתי", url: "/app/proposals", icon: Inbox },
  { title: "לוח העבודה", url: "/app/canvas", icon: Network },
  {
    title: "כל השידוכים שלי",
    url: "/app/shadchan/proposals",
    icon: ClipboardList,
  },
  // טיוטות שנשמרו בלוח העבודה וטרם נשלחו
  { title: "הצעות שמורות", url: "/app/shadchan/drafts", icon: BookmarkCheck },
  { title: "הגדרות", url: "/app/settings", icon: Settings },
] as const;

// לוח ההתאמות, רשימת השידוכים וההצעות השמורות הם כלי עבודה של שדכן/מנהל בלבד.
const shadchanOnlyUrls = [
  "/app/canvas",
  "/app/shadchan/proposals",
  "/app/shadchan/drafts",
];
// רשימת המיועדים חושפת מיועדים של אחרים, ולכן סגורה להורה. "הוספת
// מיועד" נשארת פתוחה לכולם — הורה מוסיף את ילדיו.
const staffVisibleUrls = ["/app/students"];

export function AppSidebar({ roles }: { roles: Role[] }) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
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

  const items = allItems.filter((item) => {
    if (shadchanOnlyUrls.includes(item.url)) return isShadchanOrAdmin;
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
                const isChats = item.url === CHATS_URL;
                const unreadCount = isChats ? unreadChatsCount : 0;
                // התג עצמו aria-hidden; המספר נמסר בשם הנגיש ובטולטיפ
                const label = unreadChatsLabel(item.title, unreadCount);

                const button = (
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                    className={isChats ? "relative" : undefined}
                  >
                    <Link
                      href={item.url}
                      prefetch={false}
                      aria-label={unreadCount > 0 ? label : undefined}
                    >
                      <Icon />
                      <span>{item.title}</span>
                      {isChats && (
                        <UnreadChatsBadge
                          count={unreadCount}
                          placement="sidebar"
                        />
                      )}
                    </Link>
                  </SidebarMenuButton>
                );

                return (
                  <SidebarMenuItem key={item.title}>
                    {isCollapsed ? (
                      <Tooltip>
                        <TooltipTrigger asChild>{button}</TooltipTrigger>
                        <TooltipContent side="right">{label}</TooltipContent>
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
