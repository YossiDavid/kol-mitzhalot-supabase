"use client";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Box } from "@/components/layout";
import { Button } from "@/components/ui/button";

interface TermsVersionPanelProps {
  version: number;
  /** שמירת התוכן ופרסום גרסה חדשה. true = הצליח (הקורא כבר הציג הודעה) */
  onPublish: () => Promise<boolean>;
  isDisabled?: boolean;
}

/**
 * גרסת התקנון בעורך התוכן. "שמור" רגיל (תיקון ניסוח) אינו מחייב אישור
 * מחדש; רק פרסום גרסה חדשה כאן מחייב את כל המשתמשים לאשר שוב.
 */
export function TermsVersionPanel({
  version,
  onPublish,
  isDisabled = false,
}: TermsVersionPanelProps) {
  return (
    <Box
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      data-testid="terms-version-panel"
    >
      <div className="space-y-1">
        <p className="font-bold">
          גרסה נוכחית: <span data-testid="terms-version">{version}</span>
        </p>
        <p className="text-body-sm text-muted-foreground">
          &quot;שמור&quot; מעדכן את הנוסח בלי לחייב אישור מחדש (מתאים לתיקון
          טעויות). שינוי מהותי - פרסמו גרסה חדשה, וכל המשתמשים יתבקשו לאשר את
          התקנון שוב בכניסה הבאה.
        </p>
      </div>
      <ConfirmDialog
        trigger={
          <Button type="button" variant="outline" disabled={isDisabled}>
            פרסום גרסה חדשה – לחייב אישור מחדש
          </Button>
        }
        title="פרסום גרסה חדשה של התקנון"
        description={`התוכן יישמר ויפורסם כגרסה ${version + 1}. כל המשתמשים (כולל מי שכבר אישר) יידרשו לאשר את התקנון מחדש לפני שימוש במערכת.`}
        confirmLabel="פרסום ושליחה לאישור"
        pendingLabel="מפרסם..."
        isDestructive={false}
        onConfirm={onPublish}
      />
    </Box>
  );
}
