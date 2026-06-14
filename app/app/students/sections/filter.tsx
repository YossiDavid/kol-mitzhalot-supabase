"use client";
import { useRef, useState } from "react";
import { useStudentQuery, StudentQuery } from "../page";
import { Box } from "@/components/layout";
import { TextField } from "../create/form/fields/text";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Search, SlidersHorizontal, ChevronDown } from "lucide-react";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

export default function FilterSection() {
  const { setQuery } = useStudentQuery();
  const [filter, setFilter] = useState<StudentQuery>({});
  const [expanded, setExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  function handleSearch() {
    setQuery(filter);
    setMobileOpen(false);
  }

  const activeFilterCount = Object.values(filter).filter(
    (v) => v !== undefined && v !== "",
  ).length;

  return (
    <div className="space-y-1">
      {/* כותרת עמוד */}
      <div className="pb-4 text-center md:text-start">
        <h1>רשימת פרחי אנ״ש</h1>
      </div>

      {/* מובייל: שורת סיכום + פתיחה */}
      <div className="md:hidden">
        <button
          onClick={() => setMobileOpen((o) => !o)}
          className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium shadow-sm"
        >
          <span className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            פילטרים
            {activeFilterCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
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
          <Box className="mt-2 space-y-3 p-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="m-gender">מגדר</Label>
                <NativeSelect
                  id="m-gender"
                  value={filter.gender || ""}
                  onChange={(e) => setFilter({ ...filter, gender: e.target.value })}
                >
                  <NativeSelectOption value="">הכל</NativeSelectOption>
                  <NativeSelectOption value="male">זכר</NativeSelectOption>
                  <NativeSelectOption value="female">נקבה</NativeSelectOption>
                </NativeSelect>
              </div>
              <div>
                <Label htmlFor="m-status">סטטוס</Label>
                <NativeSelect
                  id="m-status"
                  value={filter.personal_status || ""}
                  onChange={(e) => setFilter({ ...filter, personal_status: e.target.value })}
                >
                  <NativeSelectOption value="">הכל</NativeSelectOption>
                  <NativeSelectOption value="single">רווק/ה</NativeSelectOption>
                  <NativeSelectOption value="divorced">גרוש/ה</NativeSelectOption>
                  <NativeSelectOption value="widowed">אלמן/ה</NativeSelectOption>
                  <NativeSelectOption value="married">נשוי/ה</NativeSelectOption>
                </NativeSelect>
              </div>
              <div>
                <Label htmlFor="m-first">שם פרטי</Label>
                <TextField
                  type="text"
                  id="m-first"
                  onChange={(e) => setFilter({ ...filter, first_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="m-last">שם משפחה</Label>
                <TextField
                  type="text"
                  id="m-last"
                  onChange={(e) => setFilter({ ...filter, last_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="m-age">גיל מינימלי</Label>
                <TextField
                  type="number"
                  id="m-age"
                  onChange={(e) => setFilter({ ...filter, ageMin: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="m-city">עיר</Label>
                <TextField
                  type="text"
                  id="m-city"
                  onChange={(e) => setFilter({ ...filter, city: e.target.value })}
                />
              </div>
            </div>
            <Button onClick={handleSearch} className="w-full gap-2">
              <Search className="h-4 w-4" />
              חיפוש
            </Button>
          </Box>
        )}
      </div>

      {/* דסקטופ: פילטר מלא */}
      <Box className="hidden p-4 md:block">
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-2">
            <Label htmlFor="gender">מגדר</Label>
            <NativeSelect
              id="gender"
              value={filter.gender || ""}
              onChange={(e) => setFilter({ ...filter, gender: e.target.value })}
            >
              <NativeSelectOption value="">הכל</NativeSelectOption>
              <NativeSelectOption value="male">זכר</NativeSelectOption>
              <NativeSelectOption value="female">נקבה</NativeSelectOption>
            </NativeSelect>
          </div>
          <div className="col-span-2">
            <Label htmlFor="status">סטטוס</Label>
            <NativeSelect
              id="status"
              value={filter.personal_status || ""}
              onChange={(e) => setFilter({ ...filter, personal_status: e.target.value })}
            >
              <NativeSelectOption value="">הכל</NativeSelectOption>
              <NativeSelectOption value="single">רווק/ה</NativeSelectOption>
              <NativeSelectOption value="divorced">גרוש/ה</NativeSelectOption>
              <NativeSelectOption value="widowed">אלמן/ה</NativeSelectOption>
              <NativeSelectOption value="married">נשוי/ה</NativeSelectOption>
            </NativeSelect>
          </div>
          <div className="col-span-2">
            <Label htmlFor="firstName">שם פרטי</Label>
            <TextField
              type="text"
              id="firstName"
              onChange={(e) => setFilter({ ...filter, first_name: e.target.value })}
            />
          </div>
          <div className="col-span-2">
            <Label htmlFor="lastName">שם משפחה</Label>
            <TextField
              type="text"
              id="lastName"
              onChange={(e) => setFilter({ ...filter, last_name: e.target.value })}
            />
          </div>
          <div className="col-span-2">
            <Label htmlFor="ageMin">גיל מינימלי</Label>
            <TextField
              type="number"
              id="ageMin"
              onChange={(e) => setFilter({ ...filter, ageMin: e.target.value })}
            />
          </div>
          <div className="col-span-2 flex items-end gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setExpanded((v) => !v)}
              title="עוד מסננים"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
            <Button onClick={handleSearch} className="flex-1 gap-1.5">
              <Search className="h-4 w-4" />
              חיפוש
            </Button>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 grid grid-cols-12 gap-4 border-t border-border pt-4">
            <div className="col-span-2">
              <Label htmlFor="height">גובה (ס״מ)</Label>
              <TextField
                type="number"
                id="height"
                onChange={(e) => setFilter({ ...filter, height: e.target.value })}
              />
            </div>
            <div className="col-span-3">
              <Label htmlFor="fatherName">שם האב</Label>
              <TextField
                type="text"
                id="fatherName"
                onChange={(e) => setFilter({ ...filter, father_name: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="city">עיר</Label>
              <TextField
                type="text"
                id="city"
                onChange={(e) => setFilter({ ...filter, city: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="yeshiva">ישיבה</Label>
              <NativeSelect
                id="yeshiva"
                value={filter.is_yeshiva === undefined ? "" : String(filter.is_yeshiva)}
                onChange={(e: any) => setFilter({ ...filter, is_yeshiva: e.target.value })}
              >
                <NativeSelectOption value="">הכל</NativeSelectOption>
                <NativeSelectOption value="true">כן</NativeSelectOption>
                <NativeSelectOption value="false">לא</NativeSelectOption>
              </NativeSelect>
            </div>
            <div className="col-span-3">
              <Label htmlFor="yeshivaName">שם הישיבה</Label>
              <TextField
                type="text"
                id="yeshivaName"
                onChange={(e) => setFilter({ ...filter, yeshiva_name: e.target.value })}
              />
            </div>
          </div>
        )}
      </Box>
    </div>
  );
}
