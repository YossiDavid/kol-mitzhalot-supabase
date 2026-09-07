import { MessagesSquare, MessageSquareDashed } from "lucide-react";

import { cn } from "@/lib/utils";

type ChatEmptyStateProps = {
  variant: "no-rooms" | "no-selection";
  className?: string;
};

const COPY = {
  // אין למשתמש אף שיחה. שיחה נפתחת מתוך תהליך שידוך ולא ביוזמת
  // המשתמש, ולכן אין כאן קריאה לפעולה — רק הסבר מתי זה ישתנה.
  "no-rooms": {
    Icon: MessageSquareDashed,
    title: "אין צ׳אטים עדיין",
    description: "כששדכן יפתח איתך שיחה, היא תופיע כאן.",
  },
  // יש שיחות, אך לא נבחרה אחת. מוצג רק בדסקטופ — במובייל הרשימה
  // תופסת את המסך עד שנבחרת שיחה.
  "no-selection": {
    Icon: MessagesSquare,
    title: "לא נבחרה שיחה",
    description: "בחרו שיחה מהרשימה כדי לקרוא ולהשיב.",
  },
} as const;

export function ChatEmptyState({ variant, className }: ChatEmptyStateProps) {
  const { Icon, title, description } = COPY[variant];

  return (
    <div
      className={cn(
        "flex h-full flex-col items-center justify-center gap-3 px-6 py-10 text-center",
        className,
      )}
    >
      <div
        className="flex size-12 items-center justify-center rounded-full bg-muted"
        aria-hidden="true"
      >
        <Icon className="size-6 text-muted-foreground" strokeWidth={1.5} />
      </div>
      <div className="space-y-1">
        <p className="text-body-sm font-semibold text-foreground">{title}</p>
        <p className="mx-auto max-w-[28ch] text-caption text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}
