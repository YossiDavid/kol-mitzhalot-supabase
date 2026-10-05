"use client";

import { useState } from "react";
import { ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  NO_COMMUNITY_KEY,
  describeCommunityFilter,
  isCommunityChecked,
  normalizeCommunityFilter,
  type CommunityFilter,
} from "@/features/students/lib/community-filter";

const NO_COMMUNITY_LABEL = "ללא קהילה";

function optionLabel(key: string): string {
  return key === NO_COMMUNITY_KEY ? NO_COMMUNITY_LABEL : key;
}

interface CommunityFilterFieldProps {
  /** מזהים ייחודיים: גרסת המובייל והדסקטופ נמצאות שתיהן ב-DOM */
  idPrefix: string;
  value: CommunityFilter | undefined;
  options: readonly string[];
  isLoading: boolean;
  /** הטעינה נכשלה: אפשר עדיין לחפש בחיפוש החופשי */
  hasError: boolean;
  onChange: (next: CommunityFilter | undefined) => void;
  className?: string;
}

/** סינון קהילה בסגנון אקסל: חיפוש, "הכל", וסימון לכל קהילה */
export function CommunityFilterField({
  idPrefix,
  value,
  options,
  isLoading,
  hasError,
  onChange,
  className,
}: CommunityFilterFieldProps) {
  const [open, setOpen] = useState(false);
  const triggerId = `${idPrefix}community`;

  const checkedKeys = new Set(
    options.filter((option) => isCommunityChecked(value, option)),
  );
  const isAllChecked = checkedKeys.size === options.length;
  const isNoneChecked = checkedKeys.size === 0;

  const toggleOption = (key: string) => {
    const next = new Set(checkedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(normalizeCommunityFilter(next, options));
  };

  // "הכל" מסומן: מנקים הכל (כמו באקסל). אחרת מסמנים הכל = ביטול הסינון
  const toggleAll = () =>
    onChange(
      isAllChecked ? normalizeCommunityFilter(new Set(), options) : undefined,
    );

  return (
    <div className={className}>
      <Label htmlFor={triggerId}>קהילה / חסידות</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={triggerId}
            type="button"
            variant="outline"
            disabled={hasError}
            aria-label="קהילה / חסידות"
            className="w-full justify-between font-normal"
          >
            <span className="truncate">
              {hasError ? "לא זמין" : describeCommunityFilter(value)}
            </span>
            <ChevronsUpDown className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-0">
          <Command>
            <CommandInput placeholder="חיפוש קהילה..." />
            <label className="flex cursor-pointer items-center gap-2 border-b px-3 py-2 text-body-sm font-medium">
              <Checkbox
                checked={
                  isAllChecked ? true : isNoneChecked ? false : "indeterminate"
                }
                onCheckedChange={toggleAll}
                aria-label="הכל"
              />
              הכל
            </label>
            <CommandList>
              <CommandEmpty>
                {isLoading ? "טוען..." : "לא נמצאה קהילה בשם הזה"}
              </CommandEmpty>
              {options.map((key) => (
                <CommandItem
                  key={key}
                  value={optionLabel(key)}
                  onSelect={() => toggleOption(key)}
                  className="gap-2"
                >
                  <Checkbox
                    checked={checkedKeys.has(key)}
                    tabIndex={-1}
                    aria-label={optionLabel(key)}
                    className="pointer-events-none"
                  />
                  {optionLabel(key)}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
