"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Home,
  MessageCircle,
  Network,
  Plus,
  Settings,
  Users,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";

import { SidebarLogo } from "./sidebar/logo";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/user-role";

const allItems = [
  { title: "ראשי", url: "/app", icon: Home },
  { title: "מיועדים", url: "/app/students", icon: Users },
  { title: "הוספת מיועד", url: "/app/students/create", icon: Plus },
  { title: "צ'אטים", url: "/app/chats", icon: MessageCircle },
  { title: "לוח העבודה", url: "/app/canvas", icon: Network },
  { title: "הגדרות", url: "/app/settings", icon: Settings },
] as const;

const shadchanOnlyUrls = ["/app/students", "/app/students/create", "/app/canvas"];

export function AppSidebar({ role }: { role: Role }) {
  const [mounted, setMounted] = useState(false);
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const pathname = usePathname();

  useEffect(() => setMounted(true), []);

  // Use role only after mount so server and client initial render match (avoid hydration mismatch)
  const effectiveRole: Role = mounted ? role : "user";
  const isShadchanOrAdmin = effectiveRole === "shadchan" || effectiveRole === "admin";
  const items = isShadchanOrAdmin
    ? allItems
    : allItems.filter((item) => !shadchanOnlyUrls.includes(item.url));
  return (
    <Sidebar variant="floating" side="right" collapsible="icon" className="hidden md:flex">
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
                        <TooltipContent side="right">{item.title}</TooltipContent>
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
      <SidebarRail />
    </Sidebar>
  );
}
