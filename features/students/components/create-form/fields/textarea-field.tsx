"use client";

import { Textarea } from "@/components/ui/textarea";
import type { FieldControlProps } from "./field-control-types";
import { FieldFrame } from "./field-frame";
import { ensureStringValue } from "./field-values";

export function TextareaField(props: FieldControlProps) {
  const { fieldId, placeholder, isDisabled } = props;

  return (
    <FieldFrame {...props} htmlFor={fieldId}>
      {(rhfField) => (
        <Textarea
          id={fieldId}
          value={ensureStringValue(rhfField.value)}
          onChange={(event) => rhfField.onChange(event.target.value)}
          onBlur={rhfField.onBlur}
          ref={rhfField.ref}
          placeholder={placeholder}
          className="min-h-[120px]"
          disabled={isDisabled}
        />
      )}
    </FieldFrame>
  );
}
