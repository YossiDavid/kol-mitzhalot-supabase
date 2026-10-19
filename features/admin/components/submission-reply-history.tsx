import { Badge } from "@/components/ui/badge";
import type { SubmissionReply } from "@/features/contact-submissions/lib/submission-model";

const DATE_FORMAT = new Intl.DateTimeFormat("he-IL", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

type SubmissionReplyHistoryProps = {
  replies: readonly SubmissionReply[];
};

/**
 * היסטוריית התשובות לפנייה (מהישנה לחדשה): תאריך, המנהל שענה, התשובה,
 * והאם המייל נשלח בפועל. הטקסט מוצג כטקסט (React מבצע בריחה).
 */
export function SubmissionReplyHistory({
  replies,
}: SubmissionReplyHistoryProps) {
  if (replies.length === 0) return null;
  return (
    <section
      className="space-y-2"
      data-testid="submission-replies"
      aria-label="תשובות שנשלחו"
    >
      <h4 className="text-body-sm font-bold">תשובות שנשלחו</h4>
      <ul className="space-y-2">
        {replies.map((reply) => (
          <li
            key={reply.id}
            data-testid="submission-reply-item"
            className="rounded-md border bg-muted/40 p-3"
          >
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <span className="text-body-sm font-semibold">
                {reply.author_name || "מנהל"}
              </span>
              <span className="text-caption text-muted-foreground">
                {DATE_FORMAT.format(new Date(reply.created_at))}
              </span>
            </div>
            <p className="text-body-sm leading-relaxed whitespace-pre-wrap">
              {reply.body}
            </p>
            <Badge
              variant={reply.email_sent ? "success" : "neutral"}
              className="mt-2 w-fit"
            >
              {reply.email_sent
                ? `נשלח במייל ל-${reply.sent_to}`
                : "לא נשלח במייל"}
            </Badge>
          </li>
        ))}
      </ul>
    </section>
  );
}
