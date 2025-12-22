import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Star } from "lucide-react";
import Link from "next/link";

type Shadchan = {
  id: string;
  name: string;
  description: string;
  image: string;
  link: string;
};

export default function ShadchanimList({
  shadchanim,
}: {
  shadchanim: Shadchan[];
}) {
  return (
    <>
      {shadchanim.length > 0 ? (
        <></>
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>עדיין אין שדכנים שפעלו בקו”ח של ילדיך</EmptyTitle>
            <EmptyDescription>
              באפשרותך לפנות לשדכנים מתוך רשימת השדכנים המומלצים של המערכת
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link href="/app/shadchanim">
                <Star />
                לכל השדכנים המומלצים
              </Link>
            </Button>
          </EmptyContent>
        </Empty>
      )}
    </>
  );
}
