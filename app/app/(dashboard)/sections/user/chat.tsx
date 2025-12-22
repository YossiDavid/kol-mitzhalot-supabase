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
};

export default function Chat({ chats }: { chats: Chat[] }) {
  return (
    <>
      {chats.length > 0 ? (
        <></>
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
