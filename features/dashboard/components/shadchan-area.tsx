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
  /** שליפת ההצעות האחרונות נכשלה */
  activeShidduchimFailed: boolean;
  favorites: React.ComponentProps<typeof Favorites>["favorites"];
  favoritesFailed: boolean;
  chats: DashboardChat[];
  chatsFailed: boolean;
  forumPosts: React.ComponentProps<typeof Forum>["posts"];
  forumFailed: boolean;
};

/** "כלי שדכן": ההצעות שלי, המועדפים, שיחות כשדכן והפורומים */
export function ShadchanArea({
  activeShidduchim,
  activeShidduchimCount,
  activeShidduchimFailed,
  favorites,
  favoritesFailed,
  chats,
  chatsFailed,
  forumPosts,
  forumFailed,
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
        <ActiveShidduchim
          shiduchim={activeShidduchim}
          failed={activeShidduchimFailed}
        />
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
        <Favorites favorites={favorites} failed={favoritesFailed} />
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
        <Chat chats={chats} failed={chatsFailed} />
      </DashboardSection>
      <DashboardSection
        headingLevel="h3"
        title="פורום השדכנים"
        subTitle="הפוסטים האחרונים בפורום"
        button={
          <Button asChild>
            <Link href={"/app/forums" as never}>לפורום השדכנים</Link>
          </Button>
        }
      >
        <Forum posts={forumPosts} failed={forumFailed} />
      </DashboardSection>
    </DashboardArea>
  );
}
