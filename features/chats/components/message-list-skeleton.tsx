import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

// צורות קבועות (ולא אקראיות) כדי שהשלד לא "יקפוץ" בין רינדורים
const SKELETON_BUBBLES = [
  { isMe: false, width: "w-48" },
  { isMe: false, width: "w-64" },
  { isMe: true, width: "w-40" },
  { isMe: false, width: "w-56" },
  { isMe: true, width: "w-72" },
] as const;

/** שלד בזמן טעינת ההודעות, במקום להציג לרגע "אין הודעות עדיין". */
export function MessageListSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3">
      {SKELETON_BUBBLES.map((bubble, i) => (
        <div
          key={i}
          className={cn("flex", bubble.isMe ? "justify-start" : "justify-end")}
        >
          <Skeleton
            className={cn("h-11 max-w-[80%] rounded-2xl", bubble.width)}
          />
        </div>
      ))}
    </div>
  );
}
