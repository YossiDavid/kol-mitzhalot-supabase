"use client";

import { useId, useMemo } from "react";
import { useFieldArray, useWatch } from "react-hook-form";
import { Info, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CONTROL_HEIGHT } from "@/components/ui/control-size";
import { formatDateToISO } from "@/features/students/lib/build-student-payload";
import {
  LEGACY_CHILDREN_COUNT_KEY,
  formatChildAge,
  getAgeInYears,
  getChildrenCount,
} from "@/features/students/lib/previous-partner-children";
import { cn } from "@/lib/utils";
import {
  COMPACT_ROW_ACTION_CLASS,
  COMPACT_ROW_GRID_CLASS,
} from "../field-layout";
import { useConditionsMet } from "../use-form-conditions";
import { AtomicField } from "./atomic-field";
import { FieldCell } from "./field-cell";
import type {
  AnyFormControl,
  DynamicFieldProps,
  FieldMetadata,
} from "./field-control-types";
import { ensureStringValue, getParentPath, readText } from "./field-values";
import { createRepeaterTemplate, toRowFieldConfig } from "./repeater-rows";

const NO_ID_FIELDS: ReadonlySet<string> = new Set();

// שדה התאריך בפריט: הגיל שמחושב ממנו מוצג מתחתיו
const BIRTH_DATE_SEGMENT = "birthDate";

/**
 * הילדים מנישואים קודמים, בתוך השורה של הנישואים (useFieldArray על
 * "previousPartners.<i>.children"). פריט לכל ילד/ה בשורה צפופה, והמספר
 * בכותרת נגזר מהרשימה. שדות החובה בפריט מגיעים מ-fields-data כמו בכל שדה.
 */
export function ChildrenListField({
  field,
  control,
  gender,
  getLabel,
}: DynamicFieldProps) {
  const listName: string = field.name;
  const {
    fields: rows,
    append,
    remove,
  } = useFieldArray({
    control,
    name: listName,
  });
  const template = useMemo(() => createRepeaterTemplate(field), [field]);
  const headingId = useId();
  const itemLabel = readText(field.itemLabel, "פריט");
  const addLabel = readText(field.addLabel, "הוספה");
  const emptyText = readText(field.emptyText, "אין פריטים עדיין.");
  const legacyCount = useLegacyChildrenCount(control, listName);

  return (
    <section
      aria-labelledby={headingId}
      className="space-y-3 border-t border-border pt-5"
    >
      <p id={headingId} className="text-label font-bold">
        {getLabel(field, gender)} ({getChildrenCount(rows, 0)})
      </p>

      {rows.length === 0 && legacyCount > 0 && (
        <p className="flex items-start gap-2 rounded-md bg-muted px-3 py-2 text-body-sm text-muted-foreground">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            נרשמו {legacyCount} ילדים בלי פרטים - אפשר להוסיף את פרטיהם
          </span>
        </p>
      )}
      {rows.length === 0 && legacyCount === 0 && (
        <p className="text-body-sm text-muted-foreground">{emptyText}</p>
      )}

      <ol aria-labelledby={headingId} className="space-y-3 empty:hidden">
        {rows.map((row, index) => (
          <ChildRow
            key={row.id}
            list={field}
            index={index}
            title={`${itemLabel} ${index + 1}`}
            onRemove={() => remove(index)}
            control={control}
            gender={gender}
            getLabel={getLabel}
          />
        ))}
      </ol>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => append(structuredClone(template))}
      >
        <Plus aria-hidden />
        <span>{addLabel}</span>
      </Button>
    </section>
  );
}

/** מספר הילדים שנשמר בשורה ישנה בלי פרטים (student-to-form.ts). אין - 0 */
function useLegacyChildrenCount(
  control: AnyFormControl,
  listName: string,
): number {
  return useWatch({
    control,
    name: `${getParentPath(listName)}.${LEGACY_CHILDREN_COUNT_KEY}`,
    compute: (value: unknown) => getChildrenCount([], value),
  });
}

type ChildRowProps = Omit<DynamicFieldProps, "field"> & {
  list: FieldMetadata;
  index: number;
  title: string;
  onRemove: () => void;
};

function ChildRow({
  list,
  index,
  title,
  onRemove,
  ...fieldProps
}: ChildRowProps) {
  const rowFields: FieldMetadata[] = list.fields.map((child: FieldMetadata) =>
    toRowFieldConfig(child, list, index, NO_ID_FIELDS),
  );
  const birthDateName = `${list.name}.${index}.${BIRTH_DATE_SEGMENT}`;
  const ageText = useChildAgeText(fieldProps.control, birthDateName);

  return (
    <li
      aria-label={title}
      className={cn(
        COMPACT_ROW_GRID_CLASS,
        "rounded-md border border-border bg-card p-3",
      )}
    >
      {rowFields.map((rowField) => (
        <ChildRowField
          key={rowField.originalName}
          {...fieldProps}
          field={
            rowField.name === birthDateName && ageText
              ? { ...rowField, description: ageText }
              : rowField
          }
        />
      ))}
      <div className={cn(COMPACT_ROW_ACTION_CLASS, "space-y-2")}>
        {/* בגובה התווית של השדות, כדי שהכפתור יתיישר עם הפקדים */}
        <span
          aria-hidden
          className="invisible block text-label leading-snug font-bold select-none"
        >
          &nbsp;
        </span>
        <div
          className={cn(
            "flex items-center justify-end",
            CONTROL_HEIGHT.default,
          )}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`מחיקת ${title}`}
            onClick={onRemove}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 aria-hidden />
          </Button>
        </div>
      </div>
    </li>
  );
}

/** "גיל 7" מתאריך הלידה שנבחר. בלי תאריך תקין - undefined */
function useChildAgeText(
  control: AnyFormControl,
  birthDateName: string,
): string | undefined {
  return useWatch({
    control,
    name: birthDateName,
    compute: (value: unknown) => {
      const age = getAgeInYears(formatDateToISO(ensureStringValue(value)));
      return age === null ? undefined : formatChildAge(age);
    },
  });
}

function ChildRowField(props: DynamicFieldProps) {
  const isVisible = useConditionsMet(props.control, props.field.condition);
  if (!isVisible) return null;

  return (
    <FieldCell field={props.field} layout="compact">
      <AtomicField {...props} />
    </FieldCell>
  );
}
