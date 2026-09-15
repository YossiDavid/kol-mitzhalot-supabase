import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

type BoxProps = React.ComponentPropsWithoutRef<"div"> & {
  children: React.ReactNode;
  className?: string;
  asChild?: boolean;
};

// כל שאר ה-props (id, onClick, aria-*, data-*) מועברים הלאה - בעבר רק
// className הועבר, והקוראים נאלצו לעקוף עם div.box ידני
const Box = React.forwardRef<HTMLDivElement, BoxProps>(
  ({ children, asChild, className, ...props }, ref) => {
    const Comp = asChild ? Slot : "div";

    return (
      <Comp ref={ref} className={cn("box p-4", className)} {...props}>
        {children}
      </Comp>
    );
  },
);

Box.displayName = "Box";

export default Box;
