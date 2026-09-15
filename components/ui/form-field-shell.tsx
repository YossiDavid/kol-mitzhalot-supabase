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
  /** כשהפקד מגדיר id משלו. בלי זה התווית מקושרת ל-id של FormControl */
  htmlFor?: string;
  /** מעבד את הודעת השגיאה לפני התצוגה, למשל לנוסח ספציפי לשדה */
  formatMessage?: (message: string) => string;
  /**
   * פקד מורכב (למשל שם עם תוארים): children עוטפים בעצמם ב-FormControl את
   * החלק שמקבל id ושגיאה, ולכן לא נעטפים כאן
   */
  isComposite?: boolean;
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
  htmlFor,
  formatMessage,
  isComposite = false,
  children,
}: FormFieldShellProps) {
  return (
    <FormItem className={className}>
      {label && (
        // htmlFor רק כשהועבר: undefined היה דורס את הקישור ל-FormControl
        <FormLabel required={required} {...(htmlFor ? { htmlFor } : {})}>
          {label}
        </FormLabel>
      )}
      {isComposite ? children : <FormControl>{children}</FormControl>}
      {description && <FormDescription>{description}</FormDescription>}
      <FormMessage formatMessage={formatMessage} />
    </FormItem>
  );
}
