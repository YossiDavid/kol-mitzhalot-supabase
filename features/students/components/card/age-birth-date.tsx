"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * הגיל, ובלחיצה עליו תאריך הלידה בלוח העברי. כפתור אמיתי - נגיש במקלדת
 * (Enter/רווח) וקורא המסך שומע שיש מה לפתוח.
 *
 * מקבל את התאריך כמחרוזת מוכנה מהשרת (ראה `hebrewBirthDate`): תאריך הלידה
 * הלועזי לא עובר ללקוח, ובתצוגה הציבורית אין כלל מחרוזת כזו - הרכיב אז
 * מציג את הגיל כטקסט פשוט.
 */
export function AgeBirthDate({
  label,
  hebrewDate,
  className,
}: {
  /** מה שמוצג על הכפתור: "גיל 26" או "26 שנים" */
  label: string;
  hebrewDate: string | null | undefined;
  className?: string;
}) {
  if (!hebrewDate) return <span className={className}>{label}</span>;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${label} - הצגת תאריך לידה עברי`}
          data-slot="age-birth-date"
          className={`cursor-pointer rounded-sm underline decoration-dotted underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring ${className ?? ""}`}
        >
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto px-3 py-2 text-body-sm">
        <span className="text-muted-foreground">תאריך לידה: </span>
        <span data-slot="age-birth-date-value" className="font-semibold">
          {hebrewDate}
        </span>
      </PopoverContent>
    </Popover>
  );
}
