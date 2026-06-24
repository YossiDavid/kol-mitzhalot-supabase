import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Crown } from "lucide-react";
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
            <EmptyTitle>עדיין לא קיבלת הצעות משדכנים</EmptyTitle>
            <EmptyDescription>
              רוצה להצטרף למנוי פרימיום ולהבליט את המיועד/ת ברשימות השדכנים?
            </EmptyDescription>
            <Button asChild>
              <Link href="/app/premium">
                <Crown className="text-favorite fill-current" /> להצטרפות למנוי
                פרימיום
              </Link>
            </Button>
          </EmptyHeader>
        </Empty>
      )}
    </>
  );
}
