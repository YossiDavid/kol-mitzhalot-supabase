import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

/**
 * שליפת ההצעות נכשלה. מוצג במקום "אין הצעות" / 404, כדי שתקלה לא תיראה
 * כהיעדר הצעות או כהצעה שאינה קיימת.
 */
export function ProposalsLoadFailed({ title }: { title: string }) {
  return (
    <Empty data-testid="proposals-load-failed">
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>
          אנא רעננו את הדף או נסו שוב בעוד מספר דקות.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
