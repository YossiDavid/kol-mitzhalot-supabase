"use client";

import Link from "next/link";
import { HeartHandshake } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * אחרי שליחת כרטיס: המערכת אינה גובה תשלום, אבל החזקתה עולה כסף - הזמנה
 * עדינה לתרום. "המשך לכרטיס" (או סגירה) ממשיכים כרגיל.
 */
export function DonationAfterSubmitDialog({
  open,
  onContinue,
}: {
  open: boolean;
  onContinue: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onContinue()}>
      <DialogContent dir="rtl" data-testid="donation-after-submit">
        <DialogHeader className="items-center text-center">
          <span className="mb-2 flex size-14 items-center justify-center rounded-full bg-primary/15">
            <HeartHandshake className="size-7 text-primary" aria-hidden />
          </span>
          <DialogTitle>הכרטיס נשלח בהצלחה. בשעה טובה!</DialogTitle>
          <DialogDescription className="text-body">
            השימוש בקול מצהלות אינו כרוך בתשלום, ולא יהיה. עם זאת, הפעלת
            המערכת והחזקתה כרוכות בהוצאות גדולות. תרומה להחזקת המערכת תתקבל
            בברכה ובהכרת תודה, ותעזור לנו להמשיך ולסייע לעוד ועוד משפחות.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-center">
          <Button asChild>
            <Link href="/donations" target="_blank" rel="noopener noreferrer">
              לתרומה להחזקת המערכת
            </Link>
          </Button>
          <Button type="button" variant="outline" onClick={onContinue}>
            המשך לכרטיס
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
