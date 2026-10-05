import type { ClosedNoticeRecord } from "@/features/shidduchim/lib/closed-notice";
import {
  SHIDDUCH_SIDE_LABELS,
  formatDateTime,
} from "@/features/shidduchim/lib/responses";

/** מה כבר נשלח בעדכון הצד השני - לתיעוד ולמניעת שליחה כפולה בטעות */
export default function ClosedNoticesList({
  notices,
}: {
  notices: readonly ClosedNoticeRecord[];
}) {
  if (notices.length === 0) return null;

  return (
    <div className="space-y-2" data-testid="closed-notices">
      <p className="text-body-sm font-medium text-muted-foreground">
        עדכונים שנשלחו לצד השני
      </p>
      {notices.map((notice) => (
        <div key={notice.id} className="space-y-1 rounded-lg border p-3">
          <p className="text-body-sm font-semibold">
            {SHIDDUCH_SIDE_LABELS[notice.side]} עודכן
          </p>
          <p className="rounded-md bg-muted/50 p-2 text-body-sm whitespace-pre-wrap">
            {notice.message}
          </p>
          <p className="text-caption text-muted-foreground">
            {formatDateTime(notice.createdAt)}
            {notice.emailSent ? " · נשלח גם במייל" : " · התראה במערכת בלבד"}
          </p>
        </div>
      ))}
    </div>
  );
}
