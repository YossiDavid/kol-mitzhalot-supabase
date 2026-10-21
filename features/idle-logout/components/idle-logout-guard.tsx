"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useIdleLogout } from "@/features/idle-logout/lib/use-idle-logout";

const MS_PER_MINUTE = 60_000;

/** הדיאלוג לא נסגר בלחיצה בחוץ או ב-Esc: רק אחת משתי הבחירות */
const preventClose = (event: Event) => event.preventDefault();

/**
 * התנתקות אוטומטית אחרי חוסר פעילות, לכל משתמש מחובר במעטפת /app (גם בזמן
 * התחזות). דקה לפני ההתנתקות מוצג "עדיין כאן?" עם ספירה לאחור.
 * Callers: app/app/layout.tsx (רק כשההגדרה גדולה מ-0).
 */
export function IdleLogoutGuard({
  timeoutMinutes,
}: {
  timeoutMinutes: number;
}) {
  const { warningRemainingMs, stay, logoutNow } = useIdleLogout(
    timeoutMinutes * MS_PER_MINUTE,
  );
  const isOpen = warningRemainingMs !== null;
  const seconds = Math.ceil((warningRemainingMs ?? 0) / 1000);

  return (
    <Dialog open={isOpen}>
      <DialogContent
        size="sm"
        showCloseButton={false}
        onEscapeKeyDown={preventClose}
        onPointerDownOutside={preventClose}
        onInteractOutside={preventClose}
        data-testid="idle-logout-dialog"
      >
        <DialogHeader>
          <DialogTitle>עדיין כאן?</DialogTitle>
          <DialogDescription>
            לא זוהתה פעילות באתר זמן מה. לשמירה על פרטיותך, תנותק אוטומטית בעוד{" "}
            <span
              role="timer"
              className="font-semibold text-foreground tabular-nums"
              data-testid="idle-logout-countdown"
            >
              {seconds}
            </span>{" "}
            שניות.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={logoutNow}>
            להתנתק
          </Button>
          <Button type="button" onClick={stay} autoFocus>
            להישאר מחובר
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
