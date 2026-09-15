"use client";

import { useConditionsMet } from "../use-form-conditions";
import { AtomicField } from "./atomic-field";
import { FieldCell, FullRowCell } from "./field-cell";
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
      <FullRowCell name={field.name}>
        <RepeaterField {...props} />
      </FullRowCell>
    );
  }

  return (
    <FieldCell field={field}>
      <AtomicField {...props} />
    </FieldCell>
  );
}
