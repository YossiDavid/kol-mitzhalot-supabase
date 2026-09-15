"use client";

import * as React from "react";

import {
  FormControl,
  FormDescription,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

export interface FormFieldShellProps {
  label?: React.ReactNode;
  required?: boolean;
  /** טקסט עזרה - תמיד מתחת לפקד */
  description?: React.ReactNode;
  className?: string;
  /** פקד יחיד: מקבל id ו-aria-describedby דרך FormControl */
  children: React.ReactElement;
}

/**
 * המעטפת האחידה של שדה בטופס: תווית (עם סימון חובה), הפקד, טקסט עזרה
 * ושגיאה - תמיד באותו סדר ובאותם מרווחים. לשימוש בתוך render של FormField:
 *
 *   <FormField name="firstName" render={({ field }) => (
 *     <FormFieldShell label="שם פרטי" required>
 *       <Input {...field} />
 *     </FormFieldShell>
 *   )} />
 */
export function FormFieldShell({
  label,
  required,
  description,
  className,
  children,
}: FormFieldShellProps) {
  return (
    <FormItem className={className}>
      {label && <FormLabel required={required}>{label}</FormLabel>}
      <FormControl>{children}</FormControl>
      {description && <FormDescription>{description}</FormDescription>}
      <FormMessage />
    </FormItem>
  );
}
