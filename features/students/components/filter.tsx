"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";

import { Box, DashboardSection } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import {
  useStudentQuery,
  type StudentQuery,
} from "@/features/students/lib/student-query-context";
import { cn } from "@/lib/utils";

/** הכל מוחל תוך כדי הקלדה; ההשהיה חוסכת שאילתה על כל תו ועדיין מרגישה מיידית. */
const FILTER_DEBOUNCE_MS = 300;

type Option = { value: string; label: string };

const GENDER_OPTIONS: Option[] = [
  { value: "male", label: "זכר" },
  { value: "female", label: "נקבה" },
];

const STATUS_OPTIONS: Option[] = [
  { value: "single", label: "רווק/ה" },
  { value: "divorced", label: "גרוש/ה" },
  { value: "widowed", label: "אלמן/ה" },
  { value: "engaged", label: "מאורס/ה" },
  { value: "married", label: "נשוי/ה" },
];

/** הערכים של employment_history.category, כפי שנשמרים בטופס הכרטיס */
const EMPLOYMENT_OPTIONS: Option[] = [
  { value: "yeshiva", label: "לומד/ת בישיבה" },
  { value: "kolel", label: "אברך כולל" },
  { value: "havruta", label: "לומד עם חברותא" },
  { value: "seminar", label: "תלמידת סמינר" },
  { value: "profession", label: "לומד/ת מקצוע" },
  { value: "working", label: "עובד/ת" },
  { value: "at_home", label: "בבית" },
];

const YES_NO_OPTIONS: Option[] = [
  { value: "true", label: "כן" },
  { value: "false", label: "לא" },
];

type UpdateFilter = (key: keyof StudentQuery, value: string) => void;

interface FieldGroupProps {
  /** מזהים ייחודיים: גרסת המובייל והדסקטופ נמצאות שתיהן ב-DOM */
  idPrefix: string;
  filter: StudentQuery;
  onChange: UpdateFilter;
}

interface FieldProps extends FieldGroupProps {
  name: keyof StudentQuery;
  label: string;
  className?: string;
}

function TextFilter({
  idPrefix,
  name,
  label,
  filter,
  onChange,
  className,
  type = "text",
}: FieldProps & { type?: "text" | "number" }) {
  const id = `${idPrefix}${name}`;
  return (
    <div className={className}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        inputMode={type === "number" ? "numeric" : undefined}
        min={type === "number" ? 0 : undefined}
        value={filter[name] ?? ""}
        onChange={(e) => onChange(name, e.target.value)}
      />
    </div>
  );
}

function SelectFilter({
  idPrefix,
  name,
  label,
  filter,
  onChange,
  className,
  options,
}: FieldProps & { options: Option[] }) {
  const id = `${idPrefix}${name}`;
  return (
    <div className={className}>
      <Label htmlFor={id}>{label}</Label>
      <NativeSelect
        id={id}
        value={filter[name] ?? ""}
        onChange={(e) => onChange(name, e.target.value)}
      >
        <NativeSelectOption value="">הכל</NativeSelectOption>
        {options.map((option) => (
          <NativeSelectOption key={option.value} value={option.value}>
            {option.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}

/** השדות שמוצגים תמיד. מובייל: 2 עמודות; דסקטופ: 12. */
function BasicFields(props: FieldGroupProps) {
  const searchId = `${props.idPrefix}search`;
  return (
    <>
      <div className="col-span-2 md:col-span-4">
        <Label htmlFor={searchId}>חיפוש חופשי</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={searchId}
            type="text"
            placeholder="שם, עיר, קהילה…"
            className="pe-9"
            value={props.filter.search ?? ""}
            onChange={(e) => props.onChange("search", e.target.value)}
          />
        </div>
      </div>
      <SelectFilter
        {...props}
        name="gender"
        label="מגדר"
        options={GENDER_OPTIONS}
        className="md:col-span-2"
      />
      <SelectFilter
        {...props}
        name="personal_status"
        label="סטטוס"
        options={STATUS_OPTIONS}
        className="md:col-span-2"
      />
      <TextFilter
        {...props}
        name="ageMin"
        label="גיל מ־"
        type="number"
        className="md:col-span-2"
      />
      <TextFilter
        {...props}
        name="ageMax"
        label="גיל עד"
        type="number"
        className="md:col-span-2"
      />
    </>
  );
}

function AdvancedFields(props: FieldGroupProps) {
  return (
    <>
      <TextFilter
        {...props}
        name="first_name"
        label="שם פרטי"
        className="md:col-span-3"
      />
      <TextFilter
        {...props}
        name="last_name"
        label="שם משפחה"
        className="md:col-span-3"
      />
      <TextFilter
        {...props}
        name="father_name"
        label="שם האב"
        className="md:col-span-3"
      />
      <TextFilter
        {...props}
        name="city"
        label="עיר מגורים"
        className="md:col-span-3"
      />
      <TextFilter
        {...props}
        name="heightMin"
        label="גובה מ־ (ס״מ)"
        type="number"
        className="md:col-span-2"
      />
      <TextFilter
        {...props}
        name="heightMax"
        label="גובה עד (ס״מ)"
        type="number"
        className="md:col-span-2"
      />
      <SelectFilter
        {...props}
        name="employment"
        label="עיסוק"
        options={EMPLOYMENT_OPTIONS}
        className="md:col-span-3"
      />
      <SelectFilter
        {...props}
        name="is_yeshiva"
        label="תלמיד / בוגר ישיבה"
        options={YES_NO_OPTIONS}
        className="md:col-span-2"
      />
      <TextFilter
        {...props}
        name="institution"
        label="מוסד לימודים"
        className="col-span-2 md:col-span-3"
      />
    </>
  );
}

function ClearFiltersButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="sm" onClick={onClick}>
      <X />
      ניקוי הסינון
    </Button>
  );
}

export default function FilterSection() {
  const { setQuery } = useStudentQuery();
  const [filter, setFilter] = useState<StudentQuery>({});
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(filter), FILTER_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [filter, setQuery]);

  const updateFilter: UpdateFilter = (key, value) =>
    setFilter((prev) => ({ ...prev, [key]: value }));
  const clearFilter = () => setFilter({});

  const activeFilterCount = Object.values(filter).filter(
    (value) => value !== undefined && value !== "",
  ).length;

  return (
    <>
      {/* מובייל: כל השדות בפאנל אחד שנפתח בלחיצה */}
      <div className="space-y-4 md:hidden">
        <div className="text-center">
          <h1>רשימת פרחי אנ״ש</h1>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          aria-expanded={mobileOpen}
          aria-controls="mobile-student-filters"
          className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-body-sm font-medium shadow-sm"
        >
          <span className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            חיפוש וסינון
            {activeFilterCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-caption font-bold text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200",
              mobileOpen && "rotate-180",
            )}
          />
        </button>

        {mobileOpen && (
          <Box id="mobile-student-filters" className="space-y-3 p-4">
            <div className="grid grid-cols-2 gap-3">
              <BasicFields
                idPrefix="m-"
                filter={filter}
                onChange={updateFilter}
              />
              <AdvancedFields
                idPrefix="m-"
                filter={filter}
                onChange={updateFilter}
              />
            </div>
            {activeFilterCount > 0 && (
              <ClearFiltersButton onClick={clearFilter} />
            )}
          </Box>
        )}
      </div>

      {/* דסקטופ: שורת סינון בסיסית, והשאר מאחורי "סינון מתקדם" */}
      <div className="hidden md:block">
        <DashboardSection
          title="רשימת פרחי אנ״ש"
          button={
            <Button asChild>
              <Link href={"/app"}>לכל ההצעות האחרונות</Link>
            </Button>
          }
          containerClassName="p-0 space-y-4"
        >
          <div className="box space-y-4 p-4">
            <div className="grid grid-cols-12 gap-4">
              <BasicFields
                idPrefix=""
                filter={filter}
                onChange={updateFilter}
              />
            </div>

            {advancedOpen && (
              <div
                id="advanced-student-filters"
                className="grid grid-cols-12 gap-4"
              >
                <AdvancedFields
                  idPrefix=""
                  filter={filter}
                  onChange={updateFilter}
                />
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setAdvancedOpen((open) => !open)}
                aria-expanded={advancedOpen}
                aria-controls="advanced-student-filters"
              >
                <SlidersHorizontal />
                סינון מתקדם
                <ChevronDown
                  className={cn(
                    "transition-transform duration-200",
                    advancedOpen && "rotate-180",
                  )}
                />
              </Button>
              {activeFilterCount > 0 && (
                <ClearFiltersButton onClick={clearFilter} />
              )}
            </div>
          </div>
        </DashboardSection>
      </div>
    </>
  );
}
