"use client";

import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import type { FieldControlProps } from "./field-control-types";
import { FieldFrame } from "./field-frame";
import { ensureStringValue } from "./field-values";

const DEFAULT_PLACEHOLDER = "בחרו מהרשימה";

export function NativeSelectField(props: FieldControlProps) {
  const { placeholder, options, isDisabled } = props;

  return (
    <FieldFrame {...props}>
      {(rhfField) => {
        const currentValue = ensureStringValue(rhfField.value);
        return (
          <NativeSelect
            value={currentValue}
            onChange={(event) => rhfField.onChange(event.target.value)}
            onBlur={rhfField.onBlur}
            disabled={isDisabled}
          >
            {!currentValue && (
              <NativeSelectOption value="" disabled>
                {placeholder ?? DEFAULT_PLACEHOLDER}
              </NativeSelectOption>
            )}
            {options.map((option) => (
              <NativeSelectOption key={option.value} value={option.value}>
                {option.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        );
      }}
    </FieldFrame>
  );
}
