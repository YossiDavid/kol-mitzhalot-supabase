import Link from "next/link";

import { SHADCHAN_TOOLS_LABEL } from "@/components/sidebar/nav-items";
import { DashboardSection } from "@/components/layout";
import { Button } from "@/components/ui/button";

import { DashboardArea } from "./dashboard-area";
import type { DashboardChat } from "./chat-rooms-list";
import { ActiveShidduchim, Chat, Favorites, Forum } from "./shadchan";

export type ShadchanAreaProps = {
  activeShidduchim: React.ComponentProps<typeof ActiveShidduchim>["shiduchim"];
  activeShidduchimCount: number;
  favorites: React.ComponentProps<typeof Favorites>["favorites"];
  chats: DashboardChat[];
  forumPosts: React.ComponentProps<typeof Forum>["posts"];
};

/** "כלי שדכן": ההצעות שלי, המועדפים, שיחות כשדכן והפורומים */
export function ShadchanArea({
  activeShidduchim,
  activeShidduchimCount,
  favorites,
  chats,
  forumPosts,
}: ShadchanAreaProps) {
  return (
    <DashboardArea id="dashboard-area-shadchan" title={SHADCHAN_TOOLS_LABEL}>
      <DashboardSection
        headingLevel="h3"
        title="שידוכים באויר"
        titleNumber={activeShidduchimCount.toString()}
        subTitle="ההצעות האחרונות שלך"
        button={
          <Button asChild>
            <Link href={"/app/shadchan/proposals" as never}>
              לכל ההצעות שלך
            </Link>
          </Button>
        }
      >
        <ActiveShidduchim shiduchim={activeShidduchim} />
      </DashboardSection>
      <DashboardSection
        headingLevel="h3"
        title="המועדפים שלך"
        subTitle="מיועדים שעניינו אותך והוספת ללוח העבודה"
        button={
          <Button asChild>
            <Link href="/app/canvas">ללוח העבודה</Link>
          </Button>
        }
      >
        <Favorites favorites={favorites} />
      </DashboardSection>
      <DashboardSection
        headingLevel="h3"
        title="צ'אטים כשדכן"
        subTitle="שיחות עם הורים ומנהלי כרטיסים על הצעות ומיועדים"
        button={
          <Button asChild>
            <Link href="/app/chats">לכל הצ'אטים</Link>
          </Button>
        }
      >
        <Chat chats={chats} />
      </DashboardSection>
      <DashboardSection
        headingLevel="h3"
        title="הפורומים שלך"
        subTitle="הפורומים האחרונים שלך"
        button={
          <Button asChild>
            <Link href={"/app/forums" as never}>לכל הפורומים שלך</Link>
          </Button>
        }
      >
        <Forum posts={forumPosts} />
      </DashboardSection>
    </DashboardArea>
  );
}
