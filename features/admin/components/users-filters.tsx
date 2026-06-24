"use client";

import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 350;

function mergeParams(
  base: URLSearchParams,
  patch: Record<string, string | null | undefined>,
): URLSearchParams {
  const next = new URLSearchParams(base.toString());
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === undefined || v === "") next.delete(k);
    else next.set(k, v);
  }
  return next;
}

/** מסיר ערכי ברירת מחדל כדי לשמור על URL נקי */
function stripDefaults(params: URLSearchParams): string {
  const p = new URLSearchParams(params.toString());
  if (p.get("page") === "1" || !p.get("page")) p.delete("page");
  if (p.get("perPage") === "25" || !p.get("perPage")) p.delete("perPage");
  if (!p.get("q")?.trim()) p.delete("q");
  if (!p.get("role")) p.delete("role");
  if (!p.get("sort") || p.get("sort") === "joined") p.delete("sort");
  if (!p.get("order") || p.get("order") === "desc") p.delete("order");
  return p.toString();
}

export function AdminUsersFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paramsRef = useRef(searchParams);
  paramsRef.current = searchParams;

  const qFromUrl = searchParams.get("q")?.trim() ?? "";
  const role = searchParams.get("role") ?? "";
  const sort = searchParams.get("sort") ?? "joined";
  const order = searchParams.get("order") ?? "desc";
  const perPage = searchParams.get("perPage") ?? "25";

  const [searchDraft, setSearchDraft] = useState(qFromUrl);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSearchDraft(qFromUrl);
  }, [qFromUrl]);

  const replaceUrl = useCallback(
    (nextParams: URLSearchParams) => {
      const qs = stripDefaults(nextParams);
      const href = (qs ? `${pathname}?${qs}` : pathname) as Route;
      router.replace(href, { scroll: false });
    },
    [pathname, router],
  );

  const navigate = useCallback(
    (patch: Record<string, string | null | undefined>) => {
      const merged = mergeParams(paramsRef.current, patch);
      replaceUrl(merged);
    },
    [replaceUrl],
  );

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  const onSearchChange = (value: string) => {
    setSearchDraft(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const merged = mergeParams(paramsRef.current, {
        q: value.trim() || null,
        page: "1",
      });
      replaceUrl(merged);
    }, DEBOUNCE_MS);
  };

  return (
    <div
      className={cn(
        "mt-6 flex flex-col gap-4 rounded-lg border bg-muted/30 p-4 md:flex-row md:flex-wrap md:items-end",
      )}
    >
      <div className="grid w-full min-w-48 flex-1 gap-2">
        <Label htmlFor="q">חיפוש (אימייל / שם)</Label>
        <Input
          id="q"
          placeholder="הקלד לחיפוש..."
          value={searchDraft}
          onChange={(e) => onSearchChange(e.target.value)}
          autoComplete="off"
        />
      </div>
      <div className="grid w-full min-w-40 gap-2 md:w-44">
        <Label htmlFor="role">תפקיד</Label>
        <select
          id="role"
          value={role}
          onChange={(e) =>
            navigate({ role: e.target.value || null, page: "1" })
          }
          className={cn(
            "border-input bg-background h-10 w-full rounded-md border px-3 text-sm shadow-xs",
          )}
        >
          <option value="">כל התפקידים</option>
          <option value="admin">מנהל</option>
          <option value="shadchan">שדכן</option>
          <option value="user">משתמש</option>
        </select>
      </div>
      <div className="grid w-full min-w-40 gap-2 md:w-44">
        <Label htmlFor="sort">מיון לפי</Label>
        <select
          id="sort"
          value={sort}
          onChange={(e) => navigate({ sort: e.target.value, page: "1" })}
          className={cn(
            "border-input bg-background h-10 w-full rounded-md border px-3 text-sm shadow-xs",
          )}
        >
          <option value="joined">תאריך הצטרפות</option>
          <option value="email">אימייל</option>
          <option value="name">שם (פרטי+משפחה)</option>
          <option value="role">תפקיד</option>
        </select>
      </div>
      <div className="grid w-full min-w-32 gap-2 md:w-36">
        <Label htmlFor="order">כיוון</Label>
        <select
          id="order"
          value={order}
          onChange={(e) => navigate({ order: e.target.value, page: "1" })}
          className={cn(
            "border-input bg-background h-10 w-full rounded-md border px-3 text-sm shadow-xs",
          )}
        >
          <option value="desc">יורד</option>
          <option value="asc">עולה</option>
        </select>
      </div>
      <div className="grid w-full min-w-32 gap-2 md:w-32">
        <Label htmlFor="perPage">לעמוד</Label>
        <select
          id="perPage"
          value={perPage}
          onChange={(e) =>
            navigate({ perPage: e.target.value, page: "1" })
          }
          className={cn(
            "border-input bg-background h-10 w-full rounded-md border px-3 text-sm shadow-xs",
          )}
        >
          {[10, 25, 50, 100].map((n) => (
            <option key={n} value={String(n)}>
              {n}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
