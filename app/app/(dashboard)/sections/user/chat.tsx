import { Box } from "@/components/layout";
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

type Chat = {
  id: string;
  name: string;
  description: string;
  image: string;
  link: string;
  lastMessage: string | null;
  lastMessageTime?: string | null;
  lastMessageSender: string | null;
};

export default function Chat({ chats }: { chats: Chat[] }) {
  console.log("UserChat component received chats:", chats?.length || 0, chats);
  return (
    <>
      {chats.length > 0 ? (
        <Box className="space-y-4">
          {chats.map((chat) => (
            <Link
              key={chat.id}
              href={{
                pathname: "/app/chats",
                query: { room: chat.id },
              }}
              className="hover:bg-muted group flex items-center rounded-lg border p-4 transition"
            >
              <img
                src={chat.image}
                alt={chat.name}
                className="mr-4 h-10 w-10 rounded-full border"
              />
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="truncate text-base font-medium">
                    {chat.name}
                  </span>
                  {/* זמן שליחת ההודעה האחרונה (פורמט יפה) */}
                  <span className="text-muted-foreground text-xs">
                    {chat.lastMessageTime
                      ? new Date(chat.lastMessageTime).toLocaleTimeString(
                          "he-IL",
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )
                      : null}
                  </span>
                </div>
                <div className="text-muted-foreground truncate text-sm">
                  {/* פרטי השולח + תוכן ההודעה האחרונה */}
                  {chat.lastMessageSender && (
                    <span className="font-semibold">
                      {chat.lastMessageSender}:{" "}
                    </span>
                  )}
                  {chat.lastMessage ? (
                    chat.lastMessage
                  ) : (
                    <span className="italic">אין הודעות עדיין</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </Box>
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>עדיין לא קיבלת הודעות משדכנים</EmptyTitle>
            <EmptyDescription>
              אבל לא חייבים לחכות בנימוס... אפשר ומומלץ לפנות לשדכנים ולבקש
              שיחשבו
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
      )}
    </>
  );
}
