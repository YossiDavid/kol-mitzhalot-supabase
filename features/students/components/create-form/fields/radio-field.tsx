"use client";

import type { FieldControlProps } from "./field-control-types";
import {
  CHOICE_FIELD_ITEM_CLASS,
  FieldFrame,
  choiceGroupClass,
} from "./field-frame";
import { ensureStringValue } from "./field-values";

export function RadioField(props: FieldControlProps) {
  const { field, options, isDisabled } = props;

  return (
    <FieldFrame {...props} className={CHOICE_FIELD_ITEM_CLASS}>
      {(rhfField) => (
        <div className={choiceGroupClass(Boolean(field.vertical))}>
          {options.map((option) => (
            <label key={option.value} className="flex items-center gap-2">
              <input
                type="radio"
                value={option.value}
                checked={ensureStringValue(rhfField.value) === option.value}
                onChange={() => {
                  if (isDisabled) return;
                  rhfField.onChange(option.value);
                }}
                className="size-4 accent-primary"
                disabled={isDisabled}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      )}
    </FieldFrame>
  );
}
