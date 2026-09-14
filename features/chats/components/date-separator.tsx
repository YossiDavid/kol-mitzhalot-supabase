/** מפריד יום בזרם ההודעות: "היום" / "אתמול" / תאריך מלא. */
export function DateSeparator({ label }: { label: string }) {
  return (
    <div
      role="separator"
      aria-label={label}
      className="flex items-center gap-3 pt-5 pb-2 first:pt-0"
    >
      <span aria-hidden="true" className="h-px flex-1 bg-border" />
      <span className="rounded-full border border-border bg-card px-3 py-0.5 text-caption font-medium text-muted-foreground">
        {label}
      </span>
      <span aria-hidden="true" className="h-px flex-1 bg-border" />
    </div>
  );
}
