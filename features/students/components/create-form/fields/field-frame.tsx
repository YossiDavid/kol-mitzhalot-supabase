"use client";

import type { ReactElement } from "react";
import type { ControllerRenderProps, FieldValues } from "react-hook-form";

import { FormField } from "@/components/ui/form";
import { FormFieldShell } from "@/components/ui/form-field-shell";
import { cn } from "@/lib/utils";
import type { FieldControlProps } from "./field-control-types";

type FieldFrameProps = Pick<
  FieldControlProps,
  "control" | "name" | "label" | "isRequired" | "description" | "formatMessage"
> & {
  htmlFor?: string;
  className?: string;
  isComposite?: boolean;
  children: (field: ControllerRenderProps<FieldValues, string>) => ReactElement;
};

/**
 * שדה בטופס המיועדים: FormField סביב המעטפת האחידה (FormFieldShell) - תווית
 * עם כוכבית, הפקד, טקסט עזרה מתחת ושגיאה בנוסח של השדה. כל רכיב של סוג שדה
 * מספק רק את הפקד עצמו.
 */
export function FieldFrame({
  control,
  name,
  label,
  isRequired,
  description,
  formatMessage,
  htmlFor,
  className,
  isComposite,
  children,
}: FieldFrameProps) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormFieldShell
          label={label}
          required={isRequired}
          description={description}
          formatMessage={formatMessage}
          htmlFor={htmlFor}
          className={className}
          isComposite={isComposite}
        >
          {children(field)}
        </FormFieldShell>
      )}
    />
  );
}

/** קבוצת בחירה (רדיו, תיבות סימון, צ'יפים): מרווח בין התווית לאפשרויות */
export const CHOICE_FIELD_ITEM_CLASS = "space-y-3";

/**
 * רדיו ותיבות סימון באותו מרווח. המרווח האופקי גדול מזה שבין הכפתור לטקסט,
 * כדי שגבול הפריט יהיה ברור כשהשורה נשברת.
 */
export function choiceGroupClass(isVertical: boolean): string {
  return cn(
    "flex flex-wrap gap-x-7 gap-y-3",
    isVertical && "flex-col flex-nowrap gap-y-3",
  );
}
