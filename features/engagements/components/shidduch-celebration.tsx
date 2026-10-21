"use client";

import { useEffect, useState } from "react";
import { PartyPopper } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  fetchCelebration,
  markCelebrationSeen,
  newShidduchimText,
  welcomeBackText,
} from "@/features/engagements/lib/celebration";
import {
  fireBigCelebration,
  fireConfetti,
} from "@/features/engagements/lib/confetti";
import { createClient } from "@/lib/supabase/client";

/** ההודעה הקטנה נשארת מספיק זמן כדי לקרוא אותה עם הקונפטי */
const TOAST_DURATION_MS = 8_000;

/**
 * חגיגת שידוכים בכניסה ל-/app: שידוך חדש שנסגר מאז החגיגה האחרונה - קונפטי
 * והודעה קצרה שאינה חוסמת. היעדרות ארוכה - דיאלוג "ברוכים השבים" עם חגיגה
 * גדולה. נבדק פעם אחת לטעינת דף (המעטפת לא נטענת מחדש בניווט פנימי), ומסומן
 * כנראה מיד כשהוצג - כך כל חגיגה מוצגת פעם אחת בלבד.
 */
export function ShidduchCelebration() {
  const [welcomeBackCount, setWelcomeBackCount] = useState<number | null>(null);

  useEffect(() => {
    let isCancelled = false;
    const supabase = createClient();

    const run = async () => {
      const celebration = await fetchCelebration(supabase);
      if (isCancelled || !celebration) return;

      void markCelebrationSeen(supabase);
      if (celebration.kind === "welcome_back") {
        setWelcomeBackCount(celebration.count);
        void fireBigCelebration();
        return;
      }
      toast.success(newShidduchimText(celebration.count), {
        icon: <PartyPopper className="size-5" aria-hidden />,
        duration: TOAST_DURATION_MS,
        testId: "celebration-toast",
      });
      void fireConfetti();
    };

    void run();
    return () => {
      isCancelled = true;
    };
  }, []);

  if (welcomeBackCount === null) return null;

  return (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) setWelcomeBackCount(null);
      }}
    >
      <DialogContent data-testid="celebration-dialog">
        <DialogHeader className="items-center text-center">
          <PartyPopper className="size-12 text-primary" aria-hidden />
          <DialogTitle>ברוכים השבים!</DialogTitle>
          <DialogDescription className="text-body">
            {welcomeBackText(welcomeBackCount)}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center">
          <Button type="button" onClick={() => setWelcomeBackCount(null)}>
            אמן, בשורות טובות!
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
