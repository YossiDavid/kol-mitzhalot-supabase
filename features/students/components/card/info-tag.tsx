/**
 * זוג תווית/ערך בכרטיס המיועד. ערך ריק (מלבד 0) לא מרנדר כלום - כך שדה
 * שלא נשלף בענף הציבורי פשוט נעלם, בלי תנאי בכל אתר קריאה.
 */
export function InfoTag({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex flex-col">
      <span className="text-caption font-medium text-muted-foreground">
        {label}
      </span>
      <span className="text-body-sm font-semibold text-foreground">
        {value}
      </span>
    </div>
  );
}

/** הרשת האפורה שבה יושבים ה-InfoTag של מקטע "פרטים אישיים" */
export function InfoTagGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted/50 p-4 sm:grid-cols-3 lg:grid-cols-4">
      {children}
    </div>
  );
}
