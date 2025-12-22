import {
  Calendar,
  Home,
  Inbox,
  Network,
  Plus,
  Search,
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
} from "@/components/ui/sidebar";

import { SidebarLogo } from "./sidebar/logo";

// Menu items.
const items = [
  {
    title: "ראשי",
    url: "/app",
    icon: Home,
  },
  {
    title: "מיועדים",
    url: "/app/students",
    icon: Users,
  },
  {
    title: "הוספת מיועד",
    url: "/app/students/create",
    icon: Plus,
  },
  {
    title: "לוח העבודה",
    url: "/app/canvas",
    icon: Network,
  },
  {
    title: "הגדרות",
    url: "/app/settings",
    icon: Settings,
  },
];

export function AppSidebar() {
  return (
    <Sidebar variant="floating" side="right" collapsible="icon">
      <SidebarLogo />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>שדכנים</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <a href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
