"use client";

import { useState, type SyntheticEvent } from "react";
import dynamic from "next/dynamic";

import { CONTROL_HEIGHT } from "@/components/ui/control-size";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import type { FieldControlProps } from "./field-control-types";
import { FieldFrame } from "./field-frame";
import { ensureStringValue } from "./field-values";

// אותו מראה כמו Input (גובה מסולם הגבהים, פוקוס, מסגרת אדומה בשגיאה). הספרייה
// מקבלת רק מחרוזת מחלקות לשדה עצמו, ו-aria-invalid יושב על העוטף - ולכן group.
const DATE_INPUT_CLASS = cn(
  CONTROL_HEIGHT.default,
  "w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-body shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-body-sm dark:bg-input/30",
  "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
  "group-aria-invalid:border-destructive group-aria-invalid:ring-destructive/20 dark:group-aria-invalid:ring-destructive/40",
);

// bundle-dynamic-imports: lazy-load the heavy Jewish date picker so it's only
// bundled when a date field is actually rendered in the multi-step form
const ReactJewishDatePicker = dynamic(
  () =>
    import("@yossidavid/react-jewish-datepicker").then(
      (m) => m.ReactJewishDatePicker,
    ),
  { ssr: false },
);

/** כפתורי הלוח שבתוך הבורר אינם כפתורי שליחה של הטופס */
function preventButtonDefault(event: SyntheticEvent) {
  const target = event.target as HTMLElement;
  if (target.closest("button")) {
    event.preventDefault();
  }
}

/** הבורר כותב את התאריך הלועזי ל-data-greg-date של השדה, אחרי העדכון שלו */
function readGregorianDate(fieldId: string): string {
  const inputElement = document.getElementById(
    fieldId,
  ) as HTMLInputElement | null;
  return inputElement?.getAttribute("data-greg-date") ?? "";
}

type CalendarKind = "hebrew" | "gregorian";

const DISPLAY_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** ערך הטופס (DD/MM/YYYY) לערך של input type=date (YYYY-MM-DD) */
export function displayDateToIso(value: string): string {
  const match = DISPLAY_DATE.exec(value.trim());
  if (!match) return "";
  return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

/** YYYY-MM-DD מ-input type=date לערך הטופס (DD/MM/YYYY) */
export function isoDateToDisplay(value: string): string {
  const match = ISO_DATE.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
}

/**
 * בחירה בין לוח עברי ללועזי. הערך בטופס תמיד לועזי (DD/MM/YYYY), ולכן המעבר
 * בין הלוחות אינו מאבד את מה שנבחר. לא כולם מכירים את התאריך העברי.
 */
function CalendarKindToggle({
  value,
  onChange,
}: {
  value: CalendarKind;
  onChange: (next: CalendarKind) => void;
}) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      value={value}
      onValueChange={(next) => {
        if (next === "hebrew" || next === "gregorian") onChange(next);
      }}
      aria-label="סוג הלוח"
      className="mb-1.5"
    >
      <ToggleGroupItem value="hebrew">עברי</ToggleGroupItem>
      <ToggleGroupItem value="gregorian">לועזי</ToggleGroupItem>
    </ToggleGroup>
  );
}

export function DateField(props: FieldControlProps) {
  const { fieldId } = props;
  const [calendarKind, setCalendarKind] = useState<CalendarKind>("hebrew");

  return (
    <FieldFrame {...props} htmlFor={fieldId}>
      {(rhfField) => (
        // group: aria-invalid של השדה יושב על העוטף (מסגרת אדומה בשגיאה)
        <div className="group">
          {/* מחוץ לעוטף של הבורר, שמבטל ברירת מחדל של כפתורים */}
          <CalendarKindToggle value={calendarKind} onChange={setCalendarKind} />
          {calendarKind === "gregorian" ? (
            <input
              id={fieldId}
              type="date"
              className={DATE_INPUT_CLASS}
              value={displayDateToIso(ensureStringValue(rhfField.value))}
              onChange={(event) =>
                rhfField.onChange(isoDateToDisplay(event.target.value))
              }
              onBlur={rhfField.onBlur}
            />
          ) : (
            <div
              onClickCapture={preventButtonDefault}
              onMouseDownCapture={preventButtonDefault}
              onBlur={(event) => {
                // מעבר בתוך הלוח (בחירת שנה/חודש) אינו יציאה מהשדה
                if (event.currentTarget.contains(event.relatedTarget)) return;
                rhfField.onBlur();
              }}
            >
              <ReactJewishDatePicker
                id={fieldId}
                value={ensureStringValue(rhfField.value)}
                input={DATE_INPUT_CLASS}
                wrapperClassName="font-[ploni]"
                calendarWrapper="absolute z-10 mt-1 w-full rounded-lg border bg-white p-2 shadow-lg scale-y-0 origin-top transition"
                calendarWrapperOpen="scale-y-100"
                calendar="w-full bg-white"
                header="flex items-center justify-between py-2 px-1 bg-muted rounded-t-md border-b border-border"
                navButton="p-1 rounded hover:bg-accent"
                select="font-light"
                weekdayHeader="mb-2 grid grid-cols-7 text-center text-caption font-bold text-muted-foreground"
                dayCell="flex flex-col items-center justify-center rounded-md border px-2 py-2"
                dayCellSelected="border-primary bg-primary-muted font-bold"
                dayCellOutsideMonth="opacity-50"
                onChange={() => {
                  if (typeof window === "undefined") {
                    rhfField.onChange("");
                    return;
                  }
                  // בחירת יום היא בחירה שלמה: נבדק מיד, כדי ששגיאת חובה תיעלם
                  // עכשיו ולא ביציאה מהשדה (שם היא מזיזה את מה שמתחת בזמן לחיצה)
                  const updateValue = () => {
                    rhfField.onChange(readGregorianDate(fieldId));
                    rhfField.onBlur();
                  };

                  if (typeof window.requestAnimationFrame === "function") {
                    window.requestAnimationFrame(updateValue);
                  } else {
                    setTimeout(updateValue, 0);
                  }
                }}
              />
            </div>
          )}
        </div>
      )}
    </FieldFrame>
  );
}
