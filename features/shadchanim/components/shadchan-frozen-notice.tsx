import Link from "next/link";
import { Snowflake } from "lucide-react";

import { PageTitle } from "@/components/layout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const FROZEN_TITLE = "חשבון השדכן שלך מוקפא";
const FROZEN_EXPLANATION =
  "הנהלת האתר הקפיאה זמנית את הרשאות השדכן שלך, ולכן אין כרגע גישה לאזורי השדכנים. לפרטים נוספים אפשר לפנות להנהלה.";

/** באנר בעמוד הראשי לשדכן מוקפא (שאר העמוד מוצג כמו למשתמש רגיל) */
export function ShadchanFrozenBanner() {
  return (
    <Alert data-testid="shadchan-frozen-banner">
      <Snowflake aria-hidden />
      <AlertTitle>{FROZEN_TITLE}</AlertTitle>
      <AlertDescription>{FROZEN_EXPLANATION}</AlertDescription>
    </Alert>
  );
}

/**
 * שדכן שהמנהל הקפיא ומנסה להגיע לאזור של שדכנים (רשימת המיועדים, לוח
 * ההתאמות, טיוטות). הודעה ולא הפניה שקטה, כדי שיהיה ברור מה קרה.
 */
export function ShadchanFrozenNotice() {
  return (
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 py-12 text-center"
      data-testid="shadchan-frozen-notice"
    >
      <div
        className="flex size-12 items-center justify-center rounded-full bg-muted"
        aria-hidden="true"
      >
        <Snowflake className="size-6 text-muted-foreground" strokeWidth={1.5} />
      </div>
      <div className="space-y-1">
        <PageTitle>{FROZEN_TITLE}</PageTitle>
        <p className="mx-auto max-w-[42ch] text-body-sm text-muted-foreground">
          {FROZEN_EXPLANATION}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button asChild>
          <Link href="/app">לעמוד הראשי</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/contact">פנייה להנהלה</Link>
        </Button>
      </div>
    </div>
  );
}
