"use client";

import * as React from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { createClient } from "@/lib/supabase/client";
import {
  INSTITUTION_GENDER_OPTIONS,
  INSTITUTION_TYPE_OPTIONS,
  type InstitutionGender,
  type InstitutionType,
} from "../lib/institution-labels";
import {
  buildRows,
  dedupe,
  distinctValues,
  guessGender,
  guessMapping,
  guessType,
  IMPORT_TARGETS,
  IMPORT_TARGET_LABELS,
  readSpreadsheet,
  REQUIRED_TARGETS,
  type ImportTarget,
  type SheetData,
} from "../lib/excel-import";

/** Supabase מגביל גודל בקשה; מייבאים במנות כדי לא להיחסם */
const INSERT_CHUNK = 200;

export function InstitutionsImportDialog({
  onImported,
}: {
  onImported: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [sheet, setSheet] = React.useState<SheetData | null>(null);
  const [mapping, setMapping] = React.useState<Record<ImportTarget, number>>();
  const [typeMap, setTypeMap] = React.useState<
    Record<string, InstitutionType | "">
  >({});
  const [genderMap, setGenderMap] = React.useState<
    Record<string, InstitutionGender | "">
  >({});
  const [fallbackGender, setFallbackGender] =
    React.useState<InstitutionGender>("male");
  const [fallbackType, setFallbackType] =
    React.useState<InstitutionType>("yeshiva_gedola");
  const [busy, setBusy] = React.useState(false);

  const reset = () => {
    setSheet(null);
    setMapping(undefined);
    setTypeMap({});
    setGenderMap({});
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const data = await readSpreadsheet(file);
      const guessed = guessMapping(data.headers);
      setSheet(data);
      setMapping(guessed);

      // ניחוש ראשוני לכל ערך ייחודי, כדי שברוב המקרים לא יידרש
      // מיפוי ידני בכלל.
      const t: Record<string, InstitutionType | ""> = {};
      for (const v of distinctValues(data.rows, guessed.type))
        t[v] = guessType(v);
      setTypeMap(t);

      const g: Record<string, InstitutionGender | ""> = {};
      for (const v of distinctValues(data.rows, guessed.gender))
        g[v] = guessGender(v);
      setGenderMap(g);
    } catch (err) {
      console.error("Error reading spreadsheet:", err);
      toast.error(
        err instanceof Error ? err.message : "לא הצלחנו לקרוא את הקובץ",
      );
    } finally {
      setBusy(false);
    }
  };

  const preview = React.useMemo(() => {
    if (!sheet || !mapping) return null;
    const built = buildRows(sheet, mapping, typeMap, genderMap, {
      gender: fallbackGender,
      type: fallbackType,
    });
    const { unique, duplicates } = dedupe(built.valid);
    return { ...built, unique, duplicates };
  }, [sheet, mapping, typeMap, genderMap, fallbackGender, fallbackType]);

  const missingRequired =
    mapping && REQUIRED_TARGETS.filter((t) => mapping[t] < 0);

  const handleImport = async () => {
    if (!preview || preview.unique.length === 0) return;
    setBusy(true);
    try {
      const supabase = createClient();
      let inserted = 0;
      for (let i = 0; i < preview.unique.length; i += INSERT_CHUNK) {
        const chunk = preview.unique
          .slice(i, i + INSERT_CHUNK)
          .map((r) => ({ ...r, is_active: true }));
        const { error } = await supabase.from("institutions").insert(chunk);
        if (error) throw error;
        inserted += chunk.length;
      }
      toast.success(`יובאו ${inserted} מוסדות`);
      setOpen(false);
      reset();
      onImported();
    } catch (err) {
      console.error("Error importing institutions:", err);
      toast.error(
        err instanceof Error ? `שגיאה בייבוא: ${err.message}` : "שגיאה בייבוא",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="size-4" />
          ייבוא מאקסל
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>ייבוא מוסדות מקובץ אקסל</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="institutions-file">קובץ (.xlsx)</Label>
            <Input
              id="institutions-file"
              type="file"
              accept=".xlsx"
              disabled={busy}
              onChange={(e) => void handleFile(e.target.files?.[0])}
            />
            <p className="text-caption text-muted-foreground">
              נקראת השורה הראשונה ככותרות, מהגיליון הראשון בקובץ.
            </p>
          </div>

          {sheet && mapping && (
            <>
              <div className="space-y-3">
                <Label>מיפוי עמודות</Label>
                {IMPORT_TARGETS.map((target) => (
                  <div
                    key={target}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="text-body-sm">
                      {IMPORT_TARGET_LABELS[target]}
                      {REQUIRED_TARGETS.includes(target) && (
                        <span className="text-destructive">*</span>
                      )}
                    </span>
                    <NativeSelect
                      className="max-w-[60%]"
                      value={String(mapping[target])}
                      onChange={(e) =>
                        setMapping({
                          ...mapping,
                          [target]: Number(e.target.value),
                        })
                      }
                    >
                      <NativeSelectOption value="-1">
                        — לא לייבא —
                      </NativeSelectOption>
                      {sheet.headers.map((h, i) => (
                        <NativeSelectOption key={i} value={String(i)}>
                          {h}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </div>
                ))}
              </div>

              <ValueMapper
                title="מיפוי סוג מוסד"
                values={distinctValues(sheet.rows, mapping.type)}
                map={typeMap}
                onChange={(k, v) =>
                  setTypeMap({ ...typeMap, [k]: v as InstitutionType | "" })
                }
                options={INSTITUTION_TYPE_OPTIONS}
                fallbackLabel="ברירת מחדל לסוג שלא מופה"
                fallbackValue={fallbackType}
                onFallbackChange={(v) => setFallbackType(v as InstitutionType)}
              />

              <ValueMapper
                title="מיפוי מגדר"
                values={distinctValues(sheet.rows, mapping.gender)}
                map={genderMap}
                onChange={(k, v) =>
                  setGenderMap({
                    ...genderMap,
                    [k]: v as InstitutionGender | "",
                  })
                }
                options={INSTITUTION_GENDER_OPTIONS}
                fallbackLabel="ברירת מחדל למגדר שלא מופה"
                fallbackValue={fallbackGender}
                onFallbackChange={(v) =>
                  setFallbackGender(v as InstitutionGender)
                }
              />

              {preview && (
                <div className="rounded-lg border border-border bg-muted/40 p-3 text-body-sm">
                  <p className="font-semibold">סיכום</p>
                  <ul className="mt-1 space-y-0.5 text-muted-foreground">
                    <li>שורות בקובץ: {sheet.rows.length}</li>
                    <li>מוכנות לייבוא: {preview.unique.length}</li>
                    {preview.duplicates > 0 && (
                      <li>כפילויות בתוך הקובץ שדולגו: {preview.duplicates}</li>
                    )}
                    {preview.skipped.length > 0 && (
                      <li className="text-destructive">
                        נפסלו: {preview.skipped.length} (שורות{" "}
                        {preview.skipped
                          .slice(0, 5)
                          .map((s) => s.row)
                          .join(", ")}
                        {preview.skipped.length > 5 ? "…" : ""})
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {missingRequired && missingRequired.length > 0 && (
                <p className="text-body-sm text-destructive">
                  חובה למפות:{" "}
                  {missingRequired
                    .map((t) => IMPORT_TARGET_LABELS[t])
                    .join(", ")}
                </p>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={busy}
          >
            ביטול
          </Button>
          <Button
            onClick={() => void handleImport()}
            disabled={
              busy ||
              !preview ||
              preview.unique.length === 0 ||
              (missingRequired?.length ?? 0) > 0
            }
          >
            {busy ? "מייבא..." : `ייבוא ${preview?.unique.length ?? 0} מוסדות`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ValueMapper({
  title,
  values,
  map,
  onChange,
  options,
  fallbackLabel,
  fallbackValue,
  onFallbackChange,
}: {
  title: string;
  values: string[];
  map: Record<string, string>;
  onChange: (key: string, value: string) => void;
  options: { value: string; label: string }[];
  fallbackLabel: string;
  fallbackValue: string;
  onFallbackChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{title}</Label>
      {values.length === 0 ? (
        <p className="text-caption text-muted-foreground">
          לא מופתה עמודה — כל השורות יקבלו את ברירת המחדל.
        </p>
      ) : (
        values.map((v) => (
          <div key={v} className="flex items-center justify-between gap-3">
            <span className="truncate text-body-sm" title={v}>
              {v}
            </span>
            <NativeSelect
              className="max-w-[60%]"
              value={map[v] ?? ""}
              onChange={(e) => onChange(v, e.target.value)}
            >
              <NativeSelectOption value="">— ברירת מחדל —</NativeSelectOption>
              {options.map((o) => (
                <NativeSelectOption key={o.value} value={o.value}>
                  {o.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        ))
      )}
      <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
        <span className="text-caption text-muted-foreground">
          {fallbackLabel}
        </span>
        <NativeSelect
          className="max-w-[60%]"
          value={fallbackValue}
          onChange={(e) => onFallbackChange(e.target.value)}
        >
          {options.map((o) => (
            <NativeSelectOption key={o.value} value={o.value}>
              {o.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
    </div>
  );
}
