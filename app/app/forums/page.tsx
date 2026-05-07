import Link from "next/link";

import { Box, Section } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

export default function ForumsPage() {
  return (
    <Section containerClassName="py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">הפורומים שלך</h1>
        <Button asChild variant="outline">
          <Link href="/app">חזרה לאפליקציה</Link>
        </Button>
      </div>

      <Empty className="mt-8">
        <EmptyHeader>
          <EmptyTitle>הפורומים עדיין בפיתוח</EmptyTitle>
          <EmptyDescription>
            כרגע אין ממשק מלא לדיונים/הודעות בפורומים. בינתיים אפשר להפעיל
            תקשורת דרך הצ'אטים.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Box className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/app/chats">לצ׳אטים</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/app/students">רשימת המיועדים</Link>
            </Button>
          </Box>
        </EmptyContent>
      </Empty>
    </Section>
  );
}

