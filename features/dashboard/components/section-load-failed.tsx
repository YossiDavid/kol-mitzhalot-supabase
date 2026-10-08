import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

/**
 * מקטע בדשבורד ששליפת הנתונים שלו נכשלה. מוצג במקום המצב הריק, כדי
 * שתקלה לא תיראה כ"אין כאן כלום".
 */
export function SectionLoadFailed({ title }: { title: string }) {
  return (
    <Empty size="compact" data-testid="section-load-failed">
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>
          אנא רעננו את הדף או נסו שוב בעוד מספר דקות.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
