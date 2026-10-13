import type { ApplicationMessage } from "@/features/admin/lib/application-messages";

const DATE_FORMAT = new Intl.DateTimeFormat("he-IL", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

type ApplicationMessagesListProps = {
  messages: readonly ApplicationMessage[];
  heading: string;
};

/**
 * רשימת הודעות מנהל למבקש (מהחדש לישן). קומפוננטה טהורה: משמשת גם בעמודי
 * המנהל (שרת) וגם אצל המבקש (לקוח). הטקסט מוצג כטקסט (React מבצע בריחה).
 */
export function ApplicationMessagesList({
  messages,
  heading,
}: ApplicationMessagesListProps) {
  if (messages.length === 0) return null;
  return (
    <section
      className="space-y-2"
      data-testid="application-messages"
      aria-label={heading}
    >
      <h4 className="font-semibold">{heading}</h4>
      <ul className="space-y-2">
        {messages.map((message) => (
          <li
            key={message.id}
            data-testid="application-message-item"
            className="rounded-md border bg-muted/40 p-3"
          >
            <p className="text-body-sm whitespace-pre-wrap">{message.body}</p>
            <p className="mt-1 text-body-sm text-muted-foreground">
              {DATE_FORMAT.format(new Date(message.created_at))}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
