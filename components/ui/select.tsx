"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

type SelectContextValue = {
  value: string
  onValueChange?: (value: string) => void
  open: boolean
  setOpen: (open: boolean) => void
  disabled?: boolean
}

const SelectContext = React.createContext<SelectContextValue | null>(null)

function useSelectContext(component: string): SelectContextValue {
  const ctx = React.useContext(SelectContext)
  if (!ctx) {
    throw new Error(`${component} must be used within <Select>`)
  }
  return ctx
}

export type SelectProps = {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  disabled?: boolean
  children: React.ReactNode
}

function Select({
  value,
  defaultValue,
  onValueChange,
  disabled,
  children,
}: SelectProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? "")
  const [open, setOpen] = React.useState(false)

  const currentValue = value ?? internalValue

  const handleChange = (next: string) => {
    if (disabled) return
    if (value === undefined) {
      setInternalValue(next)
    }
    onValueChange?.(next)
  }

  return (
    <SelectContext.Provider
      value={{
        value: currentValue ?? "",
        onValueChange: handleChange,
        open,
        setOpen,
        disabled,
      }}
    >
      <div className="relative inline-flex w-full">{children}</div>
    </SelectContext.Provider>
  )
}

type SelectTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  className?: string
}

const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ className, children, ...props }, ref) => {
    const { open, setOpen, disabled } = useSelectContext("SelectTrigger")

    return (
      <button
        type="button"
        ref={ref}
        data-slot="select-trigger"
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none transition-colors",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
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
    )
  },
)
SelectTrigger.displayName = "SelectTrigger"

type SelectValueProps = {
  placeholder?: string
  className?: string
  children?: React.ReactNode
}

const SelectValue = ({ placeholder, className, children }: SelectValueProps) => {
  const { value } = useSelectContext("SelectValue")

  return (
    <span
      data-slot="select-value"
      className={cn(
        "truncate text-sm text-foreground",
        !value && "text-muted-foreground",
        className,
      )}
    >
      {children !== undefined ? children : (value || placeholder)}
    </span>
  )
}

type SelectContentProps = React.HTMLAttributes<HTMLDivElement> & {
  className?: string
}

const SelectContent = React.forwardRef<HTMLDivElement, SelectContentProps>(
  ({ className, children, ...props }, ref) => {
    const { open } = useSelectContext("SelectContent")
    if (!open) return null

    return (
      <div
        ref={ref}
        data-slot="select-content"
        className={cn(
          "absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover p-1 text-sm shadow-lg",
          className,
        )}
        role="listbox"
        {...props}
      >
        {children}
      </div>
    )
  },
)
SelectContent.displayName = "SelectContent"

type SelectItemProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  value: string
  className?: string
}

const SelectItem = React.forwardRef<HTMLButtonElement, SelectItemProps>(
  ({ value, className, children, ...props }, ref) => {
    const { value: currentValue, onValueChange, setOpen, disabled } =
      useSelectContext("SelectItem")

    const isSelected = currentValue === value

    return (
      <button
        ref={ref}
        type="button"
        role="option"
        aria-selected={isSelected}
        data-slot="select-item"
        className={cn(
          "flex w-full cursor-pointer items-center rounded-sm px-2 py-1.5 text-right text-sm",
          isSelected && "bg-accent text-accent-foreground",
          !isSelected && "hover:bg-accent hover:text-accent-foreground",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        disabled={disabled}
        onClick={() => {
          if (disabled) return
          onValueChange?.(value)
          setOpen(false)
        }}
        {...props}
      >
        {children}
      </button>
    )
  },
)
SelectItem.displayName = "SelectItem"

// Optional grouping components for API compatibility
const SelectGroup = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    data-slot="select-group"
    className={cn("space-y-1", className)}
    {...props}
  />
)

const SelectLabel = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    data-slot="select-label"
    className={cn("px-2 py-1 text-xs font-medium text-muted-foreground", className)}
    {...props}
  />
)

export {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
}


