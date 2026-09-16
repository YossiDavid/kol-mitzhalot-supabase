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

export default function Chat({ chats }: { chats: DashboardChat[] }) {
  if (chats.length === 0) {
    return (
      <Empty size="compact">
        <EmptyHeader>
          <EmptyTitle>עדיין לא קיבלת הודעות פרטיות בצ’אט</EmptyTitle>
          <EmptyDescription>רוצה לשאול משהו מישהו?</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link href="/app/students">
              <MessagesSquare /> לצ'אט
            </Link>
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return <DashboardChatRooms chats={chats} />;
}
