"use client";

import { Checkbox } from "@/components/ui/checkbox";
import type { FieldControlProps } from "./field-control-types";
import {
  CHOICE_FIELD_ITEM_CLASS,
  FieldFrame,
  choiceGroupClass,
} from "./field-frame";
import { ensureStringArray } from "./field-values";

/** בחירה מרובה: הערך הוא מערך הערכים שסומנו */
export function toggleArrayValue(
  current: readonly string[],
  value: string,
): string[] {
  return current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value];
}

export function CheckboxField(props: FieldControlProps) {
  const { field, options, isDisabled } = props;

  return (
    <FieldFrame {...props} className={CHOICE_FIELD_ITEM_CLASS}>
      {(rhfField) => {
        const currentValue = ensureStringArray(rhfField.value);
        return (
          <div className={choiceGroupClass(Boolean(field.vertical))}>
            {options.map((option) => (
              <label key={option.value} className="flex items-center gap-2">
                <Checkbox
                  checked={currentValue.includes(option.value)}
                  onCheckedChange={() => {
                    if (isDisabled) return;
                    rhfField.onChange(
                      toggleArrayValue(currentValue, option.value),
                    );
                  }}
                  disabled={isDisabled}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        );
      }}
    </FieldFrame>
  );
}
