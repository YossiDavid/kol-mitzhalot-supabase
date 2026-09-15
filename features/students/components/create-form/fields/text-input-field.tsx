"use client";

import { Input } from "@/components/ui/input";
import type { FieldControlProps } from "./field-control-types";
import { FieldFrame } from "./field-frame";
import { ensureStringValue } from "./field-values";

/** שדה טקסט או מספר. "switch" מוצג כשדה טקסט, כמו שהיה */
export function TextInputField(props: FieldControlProps) {
  const { field, fieldId, placeholder, isDisabled } = props;
  const isNumber = field.type === "number";

  return (
    <FieldFrame {...props} htmlFor={fieldId}>
      {(rhfField) => (
        <Input
          id={fieldId}
          value={ensureStringValue(rhfField.value)}
          onChange={(event) => rhfField.onChange(event.target.value)}
          onBlur={rhfField.onBlur}
          ref={rhfField.ref}
          type={isNumber ? "number" : "text"}
          min={isNumber ? field.min : undefined}
          max={isNumber ? field.max : undefined}
          placeholder={placeholder}
          disabled={isDisabled}
        />
      )}
    </FieldFrame>
  );
}
