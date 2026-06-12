"use client";

import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { BellRing, Crown, Home, Settings } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import React from "react";

interface HeaderIconsProps {
  /** כשמוצג תפריט משתמש (אייקון משתמש) – לא להציג אייקון הגדרות נפרד */
  hasUserMenu?: boolean;
}

export default function HeaderIcons({ hasUserMenu = false }: HeaderIconsProps) {
  // const menu: MenuItem[] = [
  //   {
  //     type: "link",
  //     href: "/",
  //     icon: <Home />,
  //   },
  //   {
  //     type: "action",
  //     onClick: () => {
  //       console.log("Clicked share button");
  //     },
  //     icon: <Share2 />,
  //   },
  //   {
  //     type: "link",
  //     href: "/",
  //     icon: <BellRing />,
  //   },
  //   {
  //     type: "link",
  //     href: "/",
  //     icon: <Settings />,
  //   },
  // ];

  const notifications = [
    {
      id: 1,
      title: "התראות 1",
      content: "התראות 1",
      created_at: new Date(),
      link: "/notifications/1", // קישור להתראה
    },
    {
      id: 2,
      title: "התראות 2",
      content: "התראות 2",
      created_at: new Date(),
      link: "/notifications/2",
    },
    {
      id: 3,
      title: "התראות 3",
      content: "התראות 3",
      created_at: new Date(),
      link: "/notifications/3",
    },
    {
      id: 4,
      title: "התראות 4",
      content: "התראות 4",
      created_at: new Date(),
      link: "/notifications/4",
    },
    {
      id: 5,
      title: "התראות 5",
      content: "התראות 5",
      created_at: new Date(),
      link: "/notifications/5",
    },
  ];

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => {
          console.log("Clicked favorite button");
        }}
      >
        <Crown className="text-favorite fill-current" />
      </Button>

      <Button variant="ghost" size="icon" asChild className="hidden md:inline-flex">
        <Link href={"/app"}>
          <Home />
        </Link>
      </Button>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <BellRing />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-bold">התראות</h1>
            </div>
            <ScrollArea className="h-[300px]">
              <div className="flex flex-col gap-2 **:data-[slot=separator]:last:hidden">
                {notifications.map((notification) => (
                  <React.Fragment key={notification.id}>
                    <div
                      key={notification.id}
                      className="flex items-center justify-between"
                    >
                      <h2 className="text-sm font-bold">
                        {notification.title}
                      </h2>
                      <Button variant="link">
                        <Link href={notification.link as any}>קרא עוד</Link>
                      </Button>
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {notification.content}
                    </p>
                    <Separator />
                  </React.Fragment>
                ))}
              </div>
            </ScrollArea>
          </div>
        </PopoverContent>
      </Popover>

      {!hasUserMenu && (
        <Button variant="ghost" size="icon" asChild>
          <Link href={"/app/settings"}>
            <Settings />
          </Link>
        </Button>
      )}
      {/* {menu.map((item, index) => {
				if (item.type === "link") {
					return (
						<Button key={index} variant="ghost" size="icon" asChild>
							<Link href={item.href}>{item.icon}</Link>
						</Button>
					)
				}

				return (
					<Button
						key={index}
						variant="ghost"
						size="icon"
						onClick={item.onClick}
					>
						{item.icon}
					</Button>
				)
			})} */}

      <ThemeSwitcher />
    </div>
  );
}
