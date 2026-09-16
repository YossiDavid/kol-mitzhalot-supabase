import * as React from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

/**
 * פריסת השדות בטפסים שאינם טופס המיועדים (docs/design-refactor/PLAN.md,
 * שלב 3): אותו מרווח בין שדות, אותה רשת ואותו מקום לכפתורי הפעולה בכל
 * טופס במערכת.
 *
 * טופס המיועדים נשאר עם הרשת הסמנטית שלו (create-form/field-layout.ts),
 * שמכילה 123 שדות ברוחבים משתנים; כאן מדובר בטפסים קצרים בעמודה אחת או
 * שתיים.
 */

/** מרווח אחיד בין שדות בטופס בעמודה אחת */
export function FormFields({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="form-fields"
      className={cn("flex flex-col gap-5", className)}
      {...props}
    />
  );
}

/**
 * הרשת מגיבה לרוחב הטופס עצמו (container query) ולא לרוחב המסך, כי סרגל
 * הצד של האפליקציה ורוחב הכרטיס משנים את המקום שבאמת זמין.
 */
const FORM_GRID_COLUMNS = {
  2: "@min-[30rem]:grid-cols-2",
  3: "@min-[30rem]:grid-cols-2 @min-[48rem]:grid-cols-3",
} as const;

export type FormGridColumns = keyof typeof FORM_GRID_COLUMNS;

/** רשת שדות: עמודה אחת במסך צר, 2 או 3 כשיש מקום */
export function FormGrid({
  columns = 2,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { columns?: FormGridColumns }) {
  return (
    // ה-@container חייב לשבת על ההורה: שאילתת מיכל נבדקת מול מיכל אב,
    // ואלמנט אינו יכול לשאול על עצמו. כשהשניים על אותו אלמנט השאילתה
    // פשוט לא מתקיימת, והרשת נשארת בעמודה אחת בכל רוחב.
    <div data-slot="form-grid" className="@container" {...props}>
      <div
        className={cn(
          "grid grid-cols-1 gap-x-4 gap-y-5",
          FORM_GRID_COLUMNS[columns],
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** שדה שתופס שורה מלאה בתוך `FormGrid` (טקסט ארוך, כתובת) */
export const FORM_GRID_FULL_CLASS = "col-span-full";

/**
 * שגיאה ברמת הטופס: כשל בשליחה לשרת, להבדיל משגיאת שדה שיושבת מתחת לשדה
 * עצמו. `Alert` כבר מכריז `role="alert"`, כך שקורא מסך שומע אותה מיד.
 */
export function FormSubmitError({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  if (!children) return null;

  return (
    <Alert variant="destructive" className={className}>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

/**
 * כפתורי הטופס. בדסקטופ בסוף השורה, ובמובייל ברוחב מלא כדי שאפשר יהיה
 * להגיע אליהם באגודל.
 */
export function FormActions({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="form-actions"
      className={cn(
        "flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end",
        "*:w-full sm:*:w-auto",
        className,
      )}
      {...props}
    />
  );
}
