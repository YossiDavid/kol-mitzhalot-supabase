"use client";

import { Button } from "@/components/ui/button";
import { toggleArrayValue } from "./checkbox-field";
import type { FieldControlProps } from "./field-control-types";
import { CHOICE_FIELD_ITEM_CLASS, FieldFrame } from "./field-frame";
import { ensureStringArray } from "./field-values";

/** "chips" / "chip": בחירה מרובה ככפתורים עגולים */
export function ChipsField(props: FieldControlProps) {
  const { options, isDisabled } = props;

  return (
    <FieldFrame {...props} className={CHOICE_FIELD_ITEM_CLASS}>
      {(rhfField) => {
        const currentValue = ensureStringArray(rhfField.value);
        return (
          <div className="flex flex-wrap gap-2">
            {options.map((option) => {
              const isActive = currentValue.includes(option.value);
              return (
                <Button
                  type="button"
                  key={option.value}
                  variant={isActive ? "default" : "outline"}
                  onClick={() => {
                    if (isDisabled) return;
                    rhfField.onChange(
                      toggleArrayValue(currentValue, option.value),
                    );
                  }}
                  disabled={isDisabled}
                  className="rounded-full px-4"
                >
                  {option.label}
                </Button>
              );
            })}
          </div>
        );
      }}
    </FieldFrame>
  );
}
