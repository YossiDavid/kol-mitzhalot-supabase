// components/ui/search-select-field.tsx
"use client"

import * as React from "react"
import { Combobox, type Option } from "@/components/ui/combobox"
import { createClient } from "@/lib/supabase/client"

type Primitive = string | number | boolean | null | undefined

export type SearchSelectFieldProps = {
  placeholder?: string
  searchPlaceholder?: string
  empty?: string

  value?: string
  onChange?: (value: string) => void
  className?: string
  disabled?: boolean

  /** אופציות סטטיות/ברירת מחדל (אופציונלי) */
  options?: Option[]

  /** Endpoint שמחזיר: { options: Option[] } */
  endpoint?: string

  /** Supabase source */
  table?: string
  valueColumn?: string // default: "id"
  /** תומך גם ב-"first_name,last_name" */
  labelColumn?: string // default: "name"
  /** תומך גם ב-"first_name,last_name" */
  searchColumn?: string // default: labelColumn

  /** פילטרים של eq */
  filters?: Record<string, Primitive>
  /** פרמטרים כלליים (למשל { limit: 50 }) */
  params?: Record<string, Primitive>

  debounceMs?: number
  minQueryLength?: number
  limit?: number

  /** אם תרצה להעביר ידנית */
  selectedLabel?: string

  /**
   * אם value נבחר אבל לא נמצא בתוצאות – נטען label לפי ה-id (Supabase בלבד)
   * ברירת מחדל: true
   */
  resolveSelectedLabel?: boolean
}

/** מפתח יציב ל-deps */
function stableKey(obj: unknown) {
  try {
    return JSON.stringify(obj ?? {})
  } catch {
    return ""
  }
}

/**
 * Escape בסיסי לטקסט ב-or() של PostgREST:
 * - פסיקים מפרידים תנאים
 * - סוגריים יכולים לשבור parsing
 */
function escapePostgrestLike(input: string) {
  return input.replace(/[(),]/g, " ").replace(/\s+/g, " ").trim()
}

function parseLimit(limit?: unknown, fallback = 50) {
  if (typeof limit === "number" && Number.isFinite(limit)) return limit
  if (typeof limit === "string") {
    const n = Number(limit)
    if (Number.isFinite(n)) return n
  }
  return fallback
}

export function SearchSelectField({
  placeholder = "בחרו...",
  searchPlaceholder = "חיפוש...",
  empty = "לא נמצאו תוצאות",
  value,
  onChange,
  className,
  disabled,
  options: initialOptions = [],
  endpoint,
  table,
  valueColumn,
  labelColumn,
  searchColumn,
  filters,
  params,
  debounceMs = 300,
  minQueryLength = 2,
  limit,
  selectedLabel: selectedLabelProp,
  resolveSelectedLabel = true,
}: SearchSelectFieldProps) {
  const [query, setQuery] = React.useState("")
  const [options, setOptions] = React.useState<Option[]>(initialOptions)
  const [isLoading, setIsLoading] = React.useState(false)

  // label שמוצג עבור value גם אם לא נמצא ב-options
  const [resolvedSelectedLabel, setResolvedSelectedLabel] = React.useState<string>(
    selectedLabelProp ?? ""
  )

  // Request guard (anti-race)
  const reqIdRef = React.useRef(0)

  const filtersKey = React.useMemo(() => stableKey(filters), [filters])
  const paramsKey = React.useMemo(() => stableKey(params), [params])

  // שמור selectedLabelProp מעודכן
  React.useEffect(() => {
    if (typeof selectedLabelProp === "string") {
      setResolvedSelectedLabel(selectedLabelProp)
    }
  }, [selectedLabelProp])

  // כשאין מקור מרוחק, תציג initialOptions
  React.useEffect(() => {
    if (!endpoint && !table) {
      setOptions(initialOptions)
    }
  }, [endpoint, table, initialOptions])

  // Resolve label לפי value (Supabase בלבד)
  React.useEffect(() => {
    if (!resolveSelectedLabel) return
    if (!table) return
    if (!value) {
      setResolvedSelectedLabel(selectedLabelProp ?? "")
      return
    }

    // אם כבר יש label בתוך options, אין צורך
    const inOptions = options.find((o) => o.value === value)?.label
    if (inOptions) {
      setResolvedSelectedLabel(inOptions)
      return
    }

    // אם כבר יש selectedLabelProp – נשתמש בו, ועדיין אפשר לשדרג בעתיד אם תרצה
    // כאן ננסה להביא label מה-DB רק אם אין.
    if (selectedLabelProp) return

    let cancelled = false
    const run = async () => {
      try {
        const supabase = createClient()
        const valCol = valueColumn || "id"
        const labCol = labelColumn || "name"
        const labelCols = labCol.split(",").map((c) => c.trim()).filter(Boolean)
        const selectCols = [valCol, ...labelCols].join(",")

        const { data, error } = await supabase
          .from(table)
          .select(selectCols)
          .eq(valCol, value)
          .maybeSingle()

        if (cancelled) return
        if (error) throw error
        if (!data) return

        const label = labelCols
          .map((col) => (data as any)?.[col])
          .filter((v) => v !== null && v !== undefined && String(v).trim() !== "")
          .join(" ")
          .trim()

        if (label) setResolvedSelectedLabel(label)
      } catch (e) {
        // לא מפיל UX; פשוט נשאר בלי label resolved
        console.error("Resolve selected label error:", e)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [
    resolveSelectedLabel,
    table,
    value,
    valueColumn,
    labelColumn,
    options,
    selectedLabelProp,
  ])

  // Fetch options (endpoint או supabase)
  React.useEffect(() => {
    const hasRemote = Boolean(endpoint || table)
    if (!hasRemote) return

    const trimmed = query.trim()

    // אם המשתמש התחיל להקליד אבל פחות מהמינימום – לא נטען
    if (minQueryLength > 0 && trimmed.length > 0 && trimmed.length < minQueryLength) {
      setOptions([])
      setIsLoading(false)
      return
    }

    const currentReqId = ++reqIdRef.current
    const controller = endpoint ? new AbortController() : null

    const run = async () => {
      setIsLoading(true)

      try {
        // Endpoint mode (רק אם אין table)
        if (endpoint && !table) {
          const url = new URL(endpoint, window.location.origin)
          if (trimmed) url.searchParams.set("search", trimmed)

          if (params) {
            Object.entries(params).forEach(([k, v]) => {
              if (v === null || v === undefined) return
              url.searchParams.set(k, String(v))
            })
          }

          const res = await fetch(url.toString(), { signal: controller?.signal })
          if (!res.ok) throw new Error("Failed to fetch options")
          const data = (await res.json()) as { options?: Option[] }

          if (currentReqId !== reqIdRef.current) return
          setOptions(data.options ?? [])
          return
        }

        // Supabase mode
        if (table) {
          const supabase = createClient()
          const valCol = valueColumn || "id"
          const labCol = labelColumn || "name"
          const searchCol = searchColumn || labCol

          const labelCols = labCol.split(",").map((c) => c.trim()).filter(Boolean)
          const searchCols = searchCol.split(",").map((c) => c.trim()).filter(Boolean)

          const selectCols = [valCol, ...labelCols].join(",")

          let qb = supabase.from(table).select(selectCols)

          // Filters (eq)
          if (filters) {
            Object.entries(filters).forEach(([k, v]) => {
              if (v === null || v === undefined) return
              qb = qb.eq(k, v as any)
            })
          }

          // Search
          if (trimmed) {
            const q = escapePostgrestLike(trimmed)
            if (searchCols.length > 1) {
              const orConditions = searchCols.map((col) => `${col}.ilike.%${q}%`).join(",")
              qb = qb.or(orConditions)
            } else if (searchCols.length === 1) {
              qb = qb.ilike(searchCols[0], `%${q}%`)
            }
          }

          const effectiveLimit = parseLimit(limit ?? params?.limit, 50)
          qb = qb.limit(effectiveLimit)

          const { data, error } = await qb
          if (error) throw error

          if (currentReqId !== reqIdRef.current) return

          const transformed: Option[] =
            data?.map((row: any) => {
              const label = labelCols
                .map((col) => row?.[col])
                .filter((v) => v !== null && v !== undefined && String(v).trim() !== "")
                .join(" ")
                .trim()

              return {
                value: String(row?.[valCol] ?? ""),
                label,
              }
            }) ?? []

          setOptions(transformed.filter((o) => o.value))
          return
        }
      } catch (e: any) {
        if (e?.name === "AbortError") return
        if (currentReqId !== reqIdRef.current) return

        console.error("SearchSelectField fetch error:", e)
        setOptions(initialOptions)
      } finally {
        if (currentReqId === reqIdRef.current) setIsLoading(false)
      }
    }

    const t = window.setTimeout(run, debounceMs)

    return () => {
      window.clearTimeout(t)
      controller?.abort()
    }
  }, [
    endpoint,
    table,
    valueColumn,
    labelColumn,
    searchColumn,
    filtersKey,
    paramsKey,
    query,
    debounceMs,
    minQueryLength,
    limit,
    initialOptions,
  ])

  return (
    <Combobox
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      empty={empty}
      value={value}
      selectedLabel={resolvedSelectedLabel}
      onChange={onChange}
      options={options}
      onQueryChange={setQuery}
      className={className}
      disabled={disabled}
      isLoading={isLoading}
      allowClearOnReselect
      resetQueryOnClose
    />
  )
}
