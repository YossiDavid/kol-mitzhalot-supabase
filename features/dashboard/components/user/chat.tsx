import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { MessagesSquare } from "lucide-react";
import Link from "next/link";

import { DashboardChatRooms, type DashboardChat } from "../chat-rooms-list";
import { SectionLoadFailed } from "../section-load-failed";

export default function Chat({
  chats,
  failed = false,
}: {
  chats: DashboardChat[];
  /** השליפה נכשלה: מציגים הודעת שגיאה ולא "אין הודעות" */
  failed?: boolean;
}) {
  if (failed) return <SectionLoadFailed title="לא הצלחנו לטעון את הצ'אטים" />;

  if (chats.length === 0) {
    return (
      <Empty size="compact">
        <EmptyHeader>
          <EmptyTitle>עדיין לא קיבלת הודעות משדכנים</EmptyTitle>
          <EmptyDescription>
            אבל לא חייבים לחכות בנימוס... אפשר ומומלץ לפנות לשדכנים ולבקש שיחשבו
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link href="/app/chats">
              <MessagesSquare /> למעבר לצ'אטים
            </Link>
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return <DashboardChatRooms chats={chats} />;
}
