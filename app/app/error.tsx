"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

/**
 * גבול שגיאות לכל דפי האפליקציה: שגיאה שלא נתפסה בדף לא מציגה מסך שבור
 * אלא הודעה ידידותית. נמצא מתחת למעטפת, ולכן התפריט נשאר במקומו.
 * ב-Next הזה הפונקציה לנסות שוב היא retry (שולף ומרנדר מחדש), לא reset.
 */
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // המזהה (digest) מתאים את השגיאה לשורה בלוג של השרת
    console.error("[app/error]", error.digest, error);
  }, [error]);

  return (
    <Empty data-testid="app-error">
      <EmptyHeader>
        <EmptyTitle>משהו השתבש</EmptyTitle>
        <EmptyDescription>
          אירעה תקלה בטעינת הדף. אפשר לנסות שוב, או לחזור לעמוד הראשי.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => retry()}>נסו שוב</Button>
          <Button asChild variant="outline">
            <Link href="/app">חזרה לעמוד הראשי</Link>
          </Button>
        </div>
      </EmptyContent>
    </Empty>
  );
}
