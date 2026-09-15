"use client";

import { Input } from "@/components/ui/input";
import type { FieldControlProps } from "./field-control-types";
import { FieldFrame } from "./field-frame";
import { isRecord } from "./field-values";

type Range = [number, number];

const DEFAULT_RANGE: Range = [18, 40];

function ensureRangeTuple(value: unknown, fallback: Range): Range {
  if (isRecord(value)) {
    const { min, max } = value;
    if (typeof min === "number" && typeof max === "number") {
      return [min, max];
    }
  }
  if (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((item) => typeof item === "number")
  ) {
    return [value[0], value[1]];
  }
  return fallback;
}

/** "range" / "rangeDouble": מינימום ומקסימום. נשמר באותה צורה שהגיע ({min,max} או [min,max]) */
export function RangeField(props: FieldControlProps) {
  const { isDisabled } = props;

  return (
    <FieldFrame {...props} isComposite>
      {(rhfField) => {
        const storeAsObject = isRecord(rhfField.value);
        const [minValue, maxValue] = ensureRangeTuple(
          rhfField.value,
          DEFAULT_RANGE,
        );

        const updateValue = (index: 0 | 1, next: number) => {
          const nextMin = index === 0 ? next : minValue;
          const nextMax = index === 1 ? next : maxValue;
          rhfField.onChange(
            storeAsObject ? { min: nextMin, max: nextMax } : [nextMin, nextMax],
          );
        };

        return (
          <div className="flex items-center gap-3">
            <Input
              type="number"
              value={minValue}
              onChange={(event) =>
                !isDisabled && updateValue(0, Number(event.target.value))
              }
              disabled={isDisabled}
            />
            <span>עד</span>
            <Input
              type="number"
              value={maxValue}
              onChange={(event) =>
                !isDisabled && updateValue(1, Number(event.target.value))
              }
              disabled={isDisabled}
            />
          </div>
        );
      }}
    </FieldFrame>
  );
}
