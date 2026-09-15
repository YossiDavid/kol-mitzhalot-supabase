import { cn } from "@/lib/utils";
import { formatUnreadCount } from "../lib/unread-rooms";

type Placement = "sidebar" | "bottom-nav";

const PLACEMENT_CLASSES: Record<Placement, string> = {
  // הסיידבר בגוון teal עמוק — זהה ל-primary — ולכן התג בהיר, בצבע הטקסט של
  // הסיידבר. במצב מכווץ נשאר רק האייקון, והתג מצטמצם לנקודה בפינתו.
  sidebar: cn(
    "ms-auto h-5 min-w-5 bg-sidebar-foreground px-1.5 text-sidebar",
    "group-data-[collapsible=icon]:absolute group-data-[collapsible=icon]:end-1 group-data-[collapsible=icon]:top-1",
    "group-data-[collapsible=icon]:size-3 group-data-[collapsible=icon]:min-w-0 group-data-[collapsible=icon]:p-0",
    "group-data-[collapsible=icon]:text-transparent group-data-[collapsible=icon]:ring-2 group-data-[collapsible=icon]:ring-sidebar",
  ),
  // יושב על פינת האייקון; הטבעת מפרידה אותו מהאייקון ומהרקע
  "bottom-nav":
    "absolute -end-3 -top-2 h-5 min-w-5 px-1 bg-primary text-primary-foreground ring-2 ring-background",
};

/**
 * תג מספר השיחות שלא נקראו. דקורטיבי בלבד (aria-hidden): המספר נמסר
 * לקוראי מסך בשם הנגיש של הקישור — ראו unreadChatsLabel.
 */
export function UnreadChatsBadge({
  count,
  placement,
}: {
  count: number;
  placement: Placement;
}) {
  if (count <= 0) return null;

  return (
    <span
      aria-hidden="true"
      data-slot="unread-chats-badge"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full text-caption leading-none font-bold tabular-nums",
        PLACEMENT_CLASSES[placement],
      )}
    >
      {formatUnreadCount(count)}
    </span>
  );
}
