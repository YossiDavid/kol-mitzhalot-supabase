import { HeartHandshake, Hourglass } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type { ForumAccess } from "@/features/forums/lib/access";

/**
 * הסבר למשתמש שאינו רשאי להיכנס לפורום, במקום עמוד ריק:
 * שדכן שממתין לאישור, או משתמש שאינו שדכן ויכול להגיש בקשה.
 */
export default function ForumAccessNotice({
  status,
}: {
  status: Exclude<ForumAccess["status"], "allowed">;
}) {
  const isPending = status === "pending";

  return (
    <Empty data-testid="forum-access-notice">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          {isPending ? (
            <Hourglass aria-hidden />
          ) : (
            <HeartHandshake aria-hidden />
          )}
        </EmptyMedia>
        <EmptyTitle>
          {isPending
            ? "הבקשה שלכם לשדכנות ממתינה לאישור"
            : "הפורום פתוח לשדכנים מאושרים בלבד"}
        </EmptyTitle>
        <EmptyDescription>
          {isPending
            ? "ברגע שצוות קול מצהלות יאשר את הבקשה, הפורום ייפתח לכם לקריאה, לפרסום ולתגובות."
            : "זהו מקום לשיתוף ידע ועצות בין שדכנים. אם אתם שדכנים, אפשר להגיש בקשה להצטרף ולקבל גישה לאחר אישור."}
        </EmptyDescription>
      </EmptyHeader>
      {isPending ? null : (
        <Button asChild>
          <Link href="/app/settings/shadchan">הצטרפות כשדכן</Link>
        </Button>
      )}
    </Empty>
  );
}
