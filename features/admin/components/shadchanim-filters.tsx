"use client";

import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import {
  SHADCHANIM_GROUPS,
  SHADCHANIM_GROUP_LABELS,
  parseShadchanimGroup,
  parseShadchanimSort,
  type AdminShadchanimSort,
} from "@/features/admin/lib/shadchanim-query";

const DEBOUNCE_MS = 350;

const SORT_LABELS: Record<AdminShadchanimSort, string> = {
  submitted: "בקשה אחרונה",
  last_seen: "נראה לאחרונה",
  active_time: "זמן פעילות במערכת",
};

/** חיפוש ומיון ברשימת "כל השדכנים"; הערכים נשמרים בכתובת (?q=&sort=) */
export function ShadchanimFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qFromUrl = searchParams.get("q") ?? "";
  const sort = parseShadchanimSort(searchParams.get("sort"));
  const group = parseShadchanimGroup(searchParams.get("group"));
  const [draft, setDraft] = useState(qFromUrl);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setDraft(qFromUrl), [qFromUrl]);
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  function navigate(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page");
    const qs = params.toString();
    router.replace((qs ? `${pathname}?${qs}` : pathname) as Route, {
      scroll: false,
    });
  }

  function onSearchChange(value: string) {
    setDraft(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(
      () => navigate({ q: value.trim() || null }),
      DEBOUNCE_MS,
    );
  }

  return (
    <div className="space-y-3">
      <div
        role="tablist"
        aria-label="קבוצת שדכנים"
        className="flex flex-wrap gap-2"
        data-testid="shadchanim-group-tabs"
      >
        {SHADCHANIM_GROUPS.map((value) => (
          <Button
            key={value}
            type="button"
            role="tab"
            aria-selected={group === value}
            size="sm"
            variant={group === value ? "default" : "outline"}
            onClick={() =>
              navigate({ group: value === "authorized" ? null : value })
            }
          >
            {SHADCHANIM_GROUP_LABELS[value]}
          </Button>
        ))}
      </div>
      <div className="flex flex-col gap-4 rounded-lg border bg-muted/30 p-4 md:flex-row md:items-end">
        <div className="grid flex-1 gap-2">
          <Label htmlFor="shadchan-search">חיפוש (שם / אימייל / טלפון)</Label>
          <Input
            id="shadchan-search"
            type="search"
            placeholder="הקלידו לחיפוש..."
            value={draft}
            onChange={(event) => onSearchChange(event.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="grid gap-2 md:w-56">
          <Label htmlFor="shadchan-sort">מיון לפי</Label>
          <NativeSelect
            id="shadchan-sort"
            value={sort}
            onChange={(event) =>
              navigate({
                sort:
                  event.target.value === "submitted"
                    ? null
                    : event.target.value,
              })
            }
          >
            {(Object.keys(SORT_LABELS) as AdminShadchanimSort[]).map((key) => (
              <NativeSelectOption key={key} value={key}>
                {SORT_LABELS[key]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>
    </div>
  );
}
