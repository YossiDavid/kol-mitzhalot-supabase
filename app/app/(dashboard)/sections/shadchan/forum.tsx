import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { MessageSquareMore } from "lucide-react";
import Link from "next/link";

type Forum = {
  id: string;
  name: string;
  description: string;
  image: string;
  link: string;
};

export default function Forum({ forums }: { forums: Forum[] }) {
  return (
    <>
      {forums.length > 0 ? (
        <></>
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>עדיין אין הודעות בפורום השדכנים</EmptyTitle>
            <EmptyDescription>
              מה דעתך לכתוב את ההודעה הראשונה?
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link href="/app/students">
                <MessageSquareMore />
                לפורום
              </Link>
            </Button>
          </EmptyContent>
        </Empty>
      )}
    </>
  );
}
