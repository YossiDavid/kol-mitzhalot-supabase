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
      )}
    </>
  );
}
