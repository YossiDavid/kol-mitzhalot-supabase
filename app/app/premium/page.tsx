import { Crown } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Page, PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

export const metadata: Metadata = {
  title: "פרימיום | קול מצהלות",
};

/**
 * מנוי הפרימיום עדיין לא נפתח להרשמה: העמוד מציג הודעת "בקרוב" במקום טופס,
 * כדי שהקישורים אליו מהמערכת לא יובילו לדף ריק.
 */
export default function PremiumPage() {
  return (
    <Page>
      <PageHeader title="פרימיום" />
      <Empty>
        <EmptyHeader>
          <Crown aria-hidden className="size-10 fill-current text-favorite" />
          <EmptyTitle>מנוי הפרימיום ייפתח בקרוב</EmptyTitle>
          <EmptyDescription>
            אנחנו עובדים על מנוי שיבליט את כרטיס המיועד/ת ברשימות השדכנים.
            נעדכן כאן ברגע שההצטרפות תיפתח.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild variant="outline">
            <Link href="/app">חזרה לעמוד הראשי</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </Page>
  );
}
