import {
  MessagesSquare,
  MessageSquareDashed,
  MessageSquarePlus,
} from "lucide-react";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

type ChatEmptyStateProps = {
  variant: "no-rooms" | "no-selection" | "no-messages";
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
  // השיחה נפתחה אך עדיין לא נשלחה בה הודעה.
  "no-messages": {
    Icon: MessageSquarePlus,
    title: "אין הודעות עדיין",
    description: "כתבו את ההודעה הראשונה בשיחה.",
  },
} as const;

/** מצב ריק בחלונית הצ'אט - Empty קומפקטי, בלי משטח (החלונית היא המשטח) */
export function ChatEmptyState({ variant, className }: ChatEmptyStateProps) {
  const { Icon, title, description } = COPY[variant];

  return (
    <Empty size="compact" surface={false} className={cn("h-full", className)}>
      <EmptyMedia variant="icon" className="size-16 rounded-2xl">
        <Icon className="size-8" strokeWidth={1.5} />
      </EmptyMedia>
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription className="max-w-[30ch]">
          {description}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
