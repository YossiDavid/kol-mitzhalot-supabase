import * as React from "react";
import { ChevronDownIcon } from "lucide-react";

import { CONTROL_HEIGHT } from "@/components/ui/control-size";
import { cn } from "@/lib/utils";

type AddonAlign = "start" | "end";

const ADDON_BORDER: Record<AddonAlign, string> = {
  start: "border-e",
  end: "border-s",
};

/**
 * שדה עם תוספות לפני ואחרי באותה מסגרת - למשל שם עם תואר לפני ואחרי.
 * המסגרת, הפוקוס והשגיאה שייכים לקבוצה; הפקדים שבתוכה בלי מסגרת משלהם.
 */
function InputGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="group"
      data-slot="input-group"
      className={cn(
        CONTROL_HEIGHT.default,
        "flex w-full min-w-0 items-stretch overflow-hidden rounded-md border border-input bg-transparent shadow-xs transition-[color,box-shadow] dark:bg-input/30",
        "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
        "has-[[aria-invalid=true]]:border-destructive has-[[aria-invalid=true]]:ring-destructive/20",
        // רק פקד מושבת - לא <option disabled> של placeholder בתוך רשימה
        "has-[input:disabled]:opacity-50 has-[select:disabled]:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

/** הפקד הראשי בקבוצה - תופס את כל הרוחב שנשאר */
function InputGroupInput({
  className,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <input
      data-slot="input-group-input"
      className={cn(
        "min-w-0 flex-1 bg-transparent px-3 text-body-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    />
  );
}

/** תוספת קבועה (טקסט או אייקון) בצד ההתחלה או הסוף */
function InputGroupAddon({
  align = "start",
  className,
  ...props
}: React.ComponentProps<"div"> & { align?: AddonAlign }) {
  return (
    <div
      data-slot="input-group-addon"
      data-align={align}
      className={cn(
        "flex shrink-0 items-center border-input bg-muted/50 px-3 text-body-sm text-muted-foreground",
        ADDON_BORDER[align],
        className,
      )}
      {...props}
    />
  );
}

/** רשימה נפתחת קומפקטית כתוספת - למשל תואר לפני או אחרי שם */
function InputGroupSelect({
  align = "start",
  className,
  ...props
}: React.ComponentProps<"select"> & { align?: AddonAlign }) {
  return (
    <div
      data-slot="input-group-select"
      data-align={align}
      className={cn(
        "relative flex shrink-0 items-stretch border-input bg-muted/50",
        ADDON_BORDER[align],
      )}
    >
      <select
        className={cn(
          "h-full max-w-32 appearance-none bg-transparent ps-3 pe-8 text-body-sm outline-none disabled:cursor-not-allowed",
          className,
        )}
        {...props}
      />
      <ChevronDownIcon
        aria-hidden
        className="pointer-events-none absolute end-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}

export { InputGroup, InputGroupAddon, InputGroupInput, InputGroupSelect };
