// "use client"

// components/ui/combobox.tsx
"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export type Option = {
  value: string
  label: string
}

export type ComboboxProps = {
  placeholder?: string
  searchPlaceholder?: string
  options: Option[]
  empty?: string

  value?: string
  /** אם הערך הנבחר לא נמצא בתוך options הנוכחי (למשל כי זה remote search) */
  selectedLabel?: string

  onChange?: (value: string) => void
  onQueryChange?: (query: string) => void

  className?: string
  disabled?: boolean
  isLoading?: boolean

  allowClearOnReselect?: boolean
  resetQueryOnClose?: boolean
}

export function Combobox({
  placeholder = "בחרו...",
  searchPlaceholder = "חיפוש...",
  options,
  empty = "לא נמצאו תוצאות",
  value,
  selectedLabel,
  onChange,
  onQueryChange,
  className,
  disabled = false,
  isLoading = false,
  allowClearOnReselect = true,
  resetQueryOnClose = true,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [inputKey, setInputKey] = React.useState(0) // remount CommandInput כדי לאפס query

  const selectedOptionLabel = React.useMemo(() => {
    if (!value) return ""
    return options.find((o) => o.value === value)?.label ?? selectedLabel ?? ""
  }, [value, options, selectedLabel])

  const triggerText = value ? (selectedOptionLabel || placeholder) : placeholder

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen)

      if (!nextOpen && resetQueryOnClose) {
        // מאפס את input (גם אם cmdk לא תומך ב-value controlled)
        setInputKey((k) => k + 1)
        onQueryChange?.("")
      }
    },
    [onQueryChange, resetQueryOnClose]
  )

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || isLoading}
          className={cn("w-full justify-between", className)}
        >
          <span className="truncate">{triggerText}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-(--radix-popover-trigger-width) p-0 **:[[cmdk-item]]:pointer-events-auto **:[[cmdk-item]]:opacity-100"
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            key={inputKey}
            placeholder={searchPlaceholder}
            className="h-9"
            onValueChange={(q) => onQueryChange?.(q)}
          />

          <CommandList>
            {isLoading ? (
              <div className="px-2 py-2 text-sm text-muted-foreground text-center">
                טוען...
              </div>
            ) : options.length === 0 ? (
              <CommandEmpty>{empty}</CommandEmpty>
            ) : (
              <CommandGroup>
                {options
                  .filter((option) => option.value && option.label)
                  .map((option) => {
                    const itemValue = String(option.value)
                    return (
                      <CommandItem
                        key={itemValue}
                        value={itemValue}
                        keywords={[itemValue, option.label]}
                        onSelect={(selectedValue) => {
                          // cmdk passes the value prop, not the option.value
                          const isSame = option.value === value
                          const nextValue =
                            allowClearOnReselect && isSame ? "" : option.value

                          onChange?.(nextValue)
                          setOpen(false)
                        }}
                      >
                        <span className="truncate">{option.label}</span>
                        <Check
                          className={cn(
                            "ml-auto h-4 w-4",
                            value === option.value ? "opacity-100" : "opacity-0"
                          )}
                        />
                      </CommandItem>
                    )
                  })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}



// import * as React from "react"
// import { Check, ChevronsUpDown } from "lucide-react"

// import { cn } from "@/lib/utils"
// import { Button } from "@/components/ui/button"
// import {
//   Command,
//   CommandEmpty,
//   CommandGroup,
//   CommandInput,
//   CommandItem,
//   CommandList,
// } from "@/components/ui/command"
// import {
//   Popover,
//   PopoverContent,
//   PopoverTrigger,
// } from "@/components/ui/popover"

// const frameworks = [
//   {
//     value: "next.js",
//     label: "Next.js",
//   },
//   {
//     value: "sveltekit",
//     label: "SvelteKit",
//   },
//   {
//     value: "nuxt.js",
//     label: "Nuxt.js",
//   },
//   {
//     value: "remix",
//     label: "Remix",
//   },
//   {
//     value: "astro",
//     label: "Astro",
//   },
// ]

// export function Combobox() {
//   const [open, setOpen] = React.useState(false)
//   const [value, setValue] = React.useState("")

//   return (
//     <Popover open={open} onOpenChange={setOpen}>
//       <PopoverTrigger asChild>
//         <Button
//           variant="outline"
//           role="combobox"
//           aria-expanded={open}
//           className="w-[200px] justify-between"
//         >
//           {value
//             ? frameworks.find((framework) => framework.value === value)?.label
//             : "Select framework..."}
//           <ChevronsUpDown className="opacity-50" />
//         </Button>
//       </PopoverTrigger>
//       <PopoverContent className="w-[200px] p-0">
//         <Command>
//           <CommandInput placeholder="Search framework..." className="h-9" />
//           <CommandList>
//             <CommandEmpty>No framework found.</CommandEmpty>
//             <CommandGroup>
//               {frameworks.map((framework) => (
//                 <CommandItem
//                   key={framework.value}
//                   value={framework.value}
//                   onSelect={(currentValue) => {
//                     setValue(currentValue === value ? "" : currentValue)
//                     setOpen(false)
//                   }}
//                 >
//                   {framework.label}
//                   <Check
//                     className={cn(
//                       "ml-auto",
//                       value === framework.value ? "opacity-100" : "opacity-0"
//                     )}
//                   />
//                 </CommandItem>
//               ))}
//             </CommandGroup>
//           </CommandList>
//         </Command>
//       </PopoverContent>
//     </Popover>
//   )
// }
