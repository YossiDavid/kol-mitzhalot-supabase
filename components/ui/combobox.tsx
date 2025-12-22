"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

type Option = {
  value: string
  label: string
}

type ComboboxProps = {
  placeholder?: string
  options: Option[]
  empty?: string
  value?: string
  onChange?: (value: string) => void
  className?: string
  endpoint?: string
  disabled?: boolean
}

export function Combobox({
  placeholder = "בחרו...",
  options,
  empty = "לא נמצאו תוצאות",
  value,
  onChange,
  className,
  disabled,
}: ComboboxProps) {
  const [query, setQuery] = React.useState("")

  const filtered =
    query.trim().length === 0
      ? options
      : options.filter((opt) =>
          opt.label.toLowerCase().includes(query.toLowerCase())
        )

  const handleSelect: React.ChangeEventHandler<HTMLSelectElement> = (event) => {
    const next = event.target.value
    if (onChange) onChange(next)
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Input
        placeholder={placeholder}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        disabled={disabled}
      />
      <select
        className={cn(
          "h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          "disabled:cursor-not-allowed disabled:opacity-50"
        )}
        value={value ?? ""}
        onChange={handleSelect}
        disabled={disabled || filtered.length === 0}
      >
        <option value="" disabled>
          {filtered.length === 0 ? empty : "בחרו מהרשימה"}
        </option>
        {filtered.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}


