"use client";

import { useMemo } from "react";
import { useWatch } from "react-hook-form";

import {
  getConditionParameters,
  matchesConditionsWith,
  type FieldCondition,
} from "./field-visibility";
import type { AnyFormControl } from "./fields/field-control-types";
import { hasNonEmptyValue } from "./fields/field-values";

/*
 * צפייה ממוקדת בערכי הטופס. כל שדה ומקטע צופה רק בערכים שהוא צריך, ומתרנדר
 * רק כשהתוצאה משתנה (compute) - במקום form.watch() באשף, שרינדר את כל
 * הטופס בכל הקשה.
 */

/** האם התנאים של שדה או מקטע מתקיימים (אותה בדיקה כמו field-visibility.ts) */
export function useConditionsMet(
  control: AnyFormControl,
  conditions: readonly FieldCondition[] | undefined,
): boolean {
  const parameters = useMemo(
    () => getConditionParameters(conditions),
    [conditions],
  );

  return useWatch({
    control,
    name: parameters,
    // בלי תנאים אין במה לצפות: תמיד מוצג
    disabled: parameters.length === 0,
    compute: (watchedValues: readonly unknown[]) =>
      matchesConditionsWith(
        conditions,
        (path) => watchedValues[parameters.indexOf(path)],
      ),
  });
}

/** האם יש ערך בנתיב, למשל בבורר "לבחירה מתוך המאגר" בשורה. בלי נתיב - false */
export function useHasValueAt(
  control: AnyFormControl,
  path: string | undefined,
): boolean {
  const names = useMemo(() => (path ? [path] : []), [path]);

  return useWatch({
    control,
    name: names,
    disabled: !path,
    compute: (watchedValues: readonly unknown[]) =>
      hasNonEmptyValue(watchedValues[0]),
  });
}
