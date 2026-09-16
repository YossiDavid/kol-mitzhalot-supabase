import { cn } from "@/lib/utils";

/**
 * סימון "יש כאן הודעה שלא נקראה" על שורת שיחה — ברשימת השיחות ובכרטיסי
 * הדשבורד. דקורטיבי בלבד: הקישור שמכיל אותו נושא שם נגיש שאומר זאת במילים
 * (ראו unreadRoomLabel).
 */
export function UnreadRoomDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      data-slot="unread-room-dot"
      className={cn("size-2.5 shrink-0 rounded-full bg-primary", className)}
    />
  );
}
