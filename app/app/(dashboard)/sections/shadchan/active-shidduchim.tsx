import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { User } from "lucide-react";
import Link from "next/link";

type Shiduch = {
  id: string;
  name: string;
  description: string;
  image: string;
  link: string;
};

export default function ActiveShidduchim({
  shiduchim,
}: {
  shiduchim: Shiduch[];
}) {
  return (
    <>
      {shiduchim.length > 0 ? (
        <></>
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>עדיין לא שלחת הצעות לשידוכים</EmptyTitle>
            <EmptyDescription>
              זה נראה כמו זמן מצוין להתחיל, לא?
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link href="/app/students">
                <User />
                לרשימת המיועדים
              </Link>
            </Button>
          </EmptyContent>
        </Empty>
      )}
    </>
  );
}
