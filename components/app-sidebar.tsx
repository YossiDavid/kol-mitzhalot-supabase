"use client";

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

const items = [
  { title: "ראשי", url: "/app", icon: Home },
  { title: "מיועדים", url: "/app/students", icon: Users },
  { title: "הוספת מיועד", url: "/app/students/create", icon: Plus },
  { title: "צ'אטים", url: "/app/chats", icon: MessageCircle },
  { title: "לוח העבודה", url: "/app/canvas", icon: Network },
  { title: "הגדרות", url: "/app/settings", icon: Settings },
] as const;

export function AppSidebar() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const pathname = usePathname();
  return (
    <Sidebar variant="floating" side="right" collapsible="icon">
      <SidebarLogo />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>שדכנים</SidebarGroupLabel>

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
