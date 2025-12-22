"use client";

import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import { BellRing, Crown, Home, Settings, Share2 } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

type MenuItem =
  | {
      type: "link";
      href: string;
      icon: ReactNode;
    }
  | {
      type: "action";
      onClick: () => void;
      icon: ReactNode;
    };

export default function HeaderIcons() {
  const menu: MenuItem[] = [
    {
      type: "link",
      href: "/",
      icon: <Home />,
    },
    {
      type: "action",
      onClick: () => {
        console.log("Clicked share button");
      },
      icon: <Share2 />,
    },
    {
      type: "link",
      href: "/",
      icon: <BellRing />,
    },
    {
      type: "link",
      href: "/",
      icon: <Settings />,
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

      <Button variant="ghost" size="icon" asChild>
        <Link href={"/app"}>
          <Home />
        </Link>
      </Button>

      {/* כפתור שיתוף - מוצג רק בעמוד פרופיל סטודנט (לא עמוד יצירה/עריכה) */}
      {typeof window !== "undefined" &&
        /^\/app\/students\/[^/]+$/.test(window.location.pathname) &&
        !/^\/app\/students\/create+$/.test(window.location.pathname) && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              console.log("Clicked share button");
            }}
          >
            <Share2 />
          </Button>
        )}

      <Button variant="ghost" size="icon" asChild>
        <Link href={"/app"}>
          <BellRing />
        </Link>
      </Button>

      <Button variant="ghost" size="icon" asChild>
        <Link href={"/app/settings"}>
          <Settings />
        </Link>
      </Button>
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
