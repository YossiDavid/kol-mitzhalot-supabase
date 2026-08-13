"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

function getNodeText(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getNodeText).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return getNodeText(node.props.children);
  }
  return "";
}

type SelectContextValue = {
  value: string;
  onValueChange?: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  disabled?: boolean;
  labels: Record<string, string>;
  registerLabel: (itemValue: string, label: string) => void;
};

const SelectContext = React.createContext<SelectContextValue | null>(null);

function useSelectContext(component: string): SelectContextValue {
  const ctx = React.useContext(SelectContext);
  if (!ctx) {
    throw new Error(`${component} must be used within <Select>`);
  }
  return ctx;
}

export type SelectProps = {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
};

function Select({
  value,
  defaultValue,
  onValueChange,
  disabled,
  children,
}: SelectProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? "");
  const [open, setOpen] = React.useState(false);
  const [labels, setLabels] = React.useState<Record<string, string>>({});
  const rootRef = React.useRef<HTMLDivElement>(null);

  const currentValue = value ?? internalValue;

  const registerLabel = React.useCallback(
    (itemValue: string, label: string) => {
      setLabels((prev) => {
        if (prev[itemValue] === label) return prev;
        return { ...prev, [itemValue]: label };
      });
    },
    [],
  );

  const handleChange = (next: string) => {
    if (disabled) return;
    if (value === undefined) {
      setInternalValue(next);
    }
    onValueChange?.(next);
  };

  React.useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (!root) return;
      if (event.target instanceof Node && !root.contains(event.target)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <SelectContext.Provider
      value={{
        value: currentValue ?? "",
        onValueChange: handleChange,
        open,
        setOpen,
        disabled,
        labels,
        registerLabel,
      }}
    >
      <div ref={rootRef} className="relative inline-flex w-full">
        {children}
      </div>
    </SelectContext.Provider>
  );
}

type SelectTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  className?: string;
};

const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ className, children, ...props }, ref) => {
    const { open, setOpen, disabled } = useSelectContext("SelectTrigger");

    return (
      <button
        type="button"
        ref={ref}
        data-slot="select-trigger"
        className={cn(
          "flex w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1.5 text-body-sm shadow-xs transition-colors outline-none dark:bg-input/30",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen(!open)}
        {...props}
      >
        {children}
      </button>
    );
  },
);
SelectTrigger.displayName = "SelectTrigger";

type SelectValueProps = {
  placeholder?: string;
  className?: string;
  children?: React.ReactNode;
};

const SelectValue = ({
  placeholder,
  className,
  children,
}: SelectValueProps) => {
  const { value, labels } = useSelectContext("SelectValue");
  const label = value ? (labels[value] ?? value) : undefined;

  return (
    <span
      data-slot="select-value"
      className={cn(
        "truncate text-body-sm text-foreground",
        !value && "text-muted-foreground",
        className,
      )}
    >
      {children !== undefined && children !== null && children !== false
        ? children
        : label || placeholder}
    </span>
  );
};

type SelectContentProps = React.HTMLAttributes<HTMLDivElement> & {
  className?: string;
};

const SelectContent = React.forwardRef<HTMLDivElement, SelectContentProps>(
  ({ className, children, ...props }, ref) => {
    const { open } = useSelectContext("SelectContent");

    return (
      <div
        ref={ref}
        data-slot="select-content"
        hidden={!open}
        className={cn(
          "absolute z-20 mt-1 w-full overflow-auto rounded-md border bg-popover p-1 text-body-sm shadow-lg",
          className,
        )}
        role="listbox"
        {...props}
      >
        {children}
      </div>
    );
  },
);
SelectContent.displayName = "SelectContent";

type SelectItemProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  value: string;
  className?: string;
};

const SelectItem = React.forwardRef<HTMLButtonElement, SelectItemProps>(
  ({ value, className, children, ...props }, ref) => {
    const {
      value: currentValue,
      onValueChange,
      setOpen,
      disabled,
      registerLabel,
    } = useSelectContext("SelectItem");

    const label = getNodeText(children);
    const isSelected = currentValue === value;

    React.useLayoutEffect(() => {
      if (label) registerLabel(value, label);
    }, [value, label, registerLabel]);

    return (
      <button
        ref={ref}
        type="button"
        role="option"
        aria-selected={isSelected}
        data-slot="select-item"
        className={cn(
          "flex w-full cursor-pointer items-center rounded-sm px-2 py-1.5 text-right text-body-sm",
          isSelected && "bg-primary-muted text-primary",
          !isSelected && "hover:bg-primary-muted hover:text-primary",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          if (label) registerLabel(value, label);
          onValueChange?.(value);
          setOpen(false);
        }}
        {...props}
      >
        {children}
      </button>
    );
  },
);
SelectItem.displayName = "SelectItem";

const SelectGroup = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    data-slot="select-group"
    className={cn("space-y-1", className)}
    {...props}
  />
);

const SelectLabel = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    data-slot="select-label"
    className={cn(
      "px-2 py-1 text-caption font-medium text-muted-foreground",
      className,
    )}
    {...props}
  />
);

export {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
};
