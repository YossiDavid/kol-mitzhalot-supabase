"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { CONTROL_HEIGHT } from "@/components/ui/control-size";
import { cn } from "@/lib/utils";
import type { FieldControlProps } from "./field-control-types";
import { FieldFrame } from "./field-frame";

/**
 * כן/לא ("switch"): תיבת סימון אחת, והערך הוא boolean. התווית מעל התיבה
 * כמו בכל שדה, והתיבה בגובה של שדה טקסט - כדי שתתיישר עם שכניה בשורה.
 */
export function BooleanField(props: FieldControlProps) {
  const { fieldId, isDisabled } = props;

  return (
    <FieldFrame {...props} htmlFor={fieldId}>
      {(rhfField) => (
        <div className={cn("flex items-center", CONTROL_HEIGHT.default)}>
          <Checkbox
            id={fieldId}
            ref={rhfField.ref}
            checked={rhfField.value === true}
            onCheckedChange={(checked) => rhfField.onChange(checked === true)}
            onBlur={rhfField.onBlur}
            disabled={isDisabled}
          />
        </div>
      )}
    </FieldFrame>
  );
}
