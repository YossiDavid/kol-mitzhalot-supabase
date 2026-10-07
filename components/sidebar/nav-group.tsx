"use client";

import Link from "next/link";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { UnreadChatsBadge } from "@/features/chats/components/unread-chats-badge";
import { unreadChatsLabel } from "@/features/chats/lib/unread-rooms";

import { CHATS_URL, type NavGroup, type NavItem } from "./nav-items";

type NavItemLinkProps = {
  item: NavItem;
  isActive: boolean;
  isCollapsed: boolean;
  unreadChatsCount: number;
};

function NavItemLink({
  item,
  isActive,
  isCollapsed,
  unreadChatsCount,
}: NavItemLinkProps) {
  const Icon = item.icon;
  const isChats = item.url === CHATS_URL;
  const unreadCount = isChats ? unreadChatsCount : 0;
  // התג עצמו aria-hidden; המספר נמסר בשם הנגיש ובטולטיפ
  const label = unreadChatsLabel(item.title, unreadCount);

  const button = (
    <SidebarMenuButton
      asChild
      isActive={isActive}
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
          <UnreadChatsBadge count={unreadCount} placement="sidebar" />
        )}
      </Link>
    </SidebarMenuButton>
  );

  return (
    <SidebarMenuItem>
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
}

type SidebarNavGroupProps = {
  group: NavGroup;
  pathname: string;
  isCollapsed: boolean;
  unreadChatsCount: number;
};

/** קבוצת ניווט עם תווית, ובתוכה הפריטים שלה */
export function SidebarNavGroup({
  group,
  pathname,
  isCollapsed,
  unreadChatsCount,
}: SidebarNavGroupProps) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {group.items.map((item) => (
            <NavItemLink
              key={item.url}
              item={item}
              isActive={pathname === item.url}
              isCollapsed={isCollapsed}
              unreadChatsCount={unreadChatsCount}
            />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
