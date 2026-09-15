"use client";

import { cn } from "@/lib/utils";
import { FIELD_SCROLL_MARGIN_CLASS, fieldCellAttributes } from "../field-layout";
import { useConditionsMet } from "../use-form-conditions";
import { AtomicField } from "./atomic-field";
import { FieldCell } from "./field-cell";
import type { DynamicFieldProps } from "./field-control-types";
import { RepeaterField } from "./repeater-field";

export type { DynamicFieldProps } from "./field-control-types";

/**
 * שדה בטופס המיועדים לפי ההגדרה ב-fields-data: מוסתר כשהתנאים לא מתקיימים,
 * רשומה חוזרת בשורה מלאה, וכל סוג אחר בתא ברוחב שלו (atomic-field.tsx).
 */
export function DynamicField(props: DynamicFieldProps) {
  const { field, control } = props;
  const isVisible = useConditionsMet(control, field.condition);

  if (!isVisible) {
    return null;
  }

  if (field.type === "repeater") {
    return (
      <div
        className={cn("col-span-12", FIELD_SCROLL_MARGIN_CLASS)}
        {...fieldCellAttributes(field.name)}
      >
        <RepeaterField {...props} />
      </div>
    );
  }

  return (
    <FieldCell field={field}>
      <AtomicField {...props} />
    </FieldCell>
  );
}
