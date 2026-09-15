"use client";

import { useMemo } from "react";
import { useFieldArray, useFormState } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FIELD_GRID_CLASS } from "../field-layout";
import { getRepeaterRequiredMessage } from "../field-messages";
import { getValueByPath } from "../field-visibility";
import { useConditionsMet } from "../use-form-conditions";
import { AtomicField } from "./atomic-field";
import { ChildrenListField } from "./children-list-field";
import { FieldCell, FullRowCell, renderBeforeField } from "./field-cell";
import type {
  AnyFormControl,
  DynamicFieldProps,
  FieldMetadata,
} from "./field-control-types";
import { readText } from "./field-values";
import {
  createRepeaterTemplate,
  getRenderedChildFields,
  getRowIdFieldPaths,
  toRowFieldConfig,
} from "./repeater-rows";

/**
 * שגיאה על הרשומה עצמה ("לפחות שורה אחת"), לא על שדה בשורה. בשדה בתוך
 * רשומה, resolvers שם אותה תחת root.
 */
function useRepeaterRootError(control: AnyFormControl, name: string) {
  const { errors } = useFormState({ control, name });
  const error = getValueByPath(errors, name) as
    | { message?: unknown; root?: { message?: unknown } }
    | undefined;
  const message = error?.message ?? error?.root?.message;
  return typeof message === "string" && message ? message : undefined;
}

/** רשומה חוזרת: כרטיס שטוח לכל שורה, כפתור הוספה ומצב ריק מהנתונים */
export function RepeaterField({
  field,
  control,
  gender,
  getLabel,
}: DynamicFieldProps) {
  const {
    fields: rows,
    append,
    remove,
  } = useFieldArray({ control, name: field.name });
  const template = useMemo(() => createRepeaterTemplate(field), [field]);
  const itemLabel = readText(field.itemLabel, "רשומה");
  const addLabel = readText(field.addLabel, "הוספת רשומה");
  const emptyText = readText(field.emptyText, "אין רשומות עדיין.");
  const rootErrorMessage = useRepeaterRootError(control, field.name);

  return (
    <div className="space-y-4">
      {renderBeforeField(field.beforeField ?? field.before, { inGrid: false })}
      {rows.length === 0 && (
        <p className="text-body-sm text-muted-foreground">{emptyText}</p>
      )}

      <ol className="space-y-4 empty:hidden">
        {rows.map((row, index) => (
          <RepeaterRow
            key={row.id}
            repeater={field}
            index={index}
            title={`${itemLabel} ${index + 1}`}
            onRemove={() => remove(index)}
            control={control}
            gender={gender}
            getLabel={getLabel}
          />
        ))}
      </ol>

      {rootErrorMessage && (
        <p className="text-body-sm font-medium text-destructive">
          {getRepeaterRequiredMessage(rootErrorMessage, itemLabel)}
        </p>
      )}

      <Button
        type="button"
        variant="outline"
        onClick={() => append(structuredClone(template))}
      >
        <Plus aria-hidden />
        <span>{addLabel}</span>
      </Button>
    </div>
  );
}

type RepeaterRowProps = Omit<DynamicFieldProps, "field"> & {
  repeater: FieldMetadata;
  index: number;
  title: string;
  onRemove: () => void;
};

function RepeaterRow({
  repeater,
  index,
  title,
  onRemove,
  ...fieldProps
}: RepeaterRowProps) {
  const idFieldPaths = getRowIdFieldPaths(repeater, index);
  const innerFields: FieldMetadata[] = getRenderedChildFields(repeater);

  return (
    <li className="rounded-lg border border-border p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-label font-bold">{title}</p>
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
      <div className={FIELD_GRID_CLASS}>
        {innerFields.map((innerField) => {
          const rowField = toRowFieldConfig(
            innerField,
            repeater,
            index,
            idFieldPaths,
          );
          return (
            <RepeaterRowField
              key={rowField.originalName}
              {...fieldProps}
              field={rowField}
            />
          );
        })}
      </div>
    </li>
  );
}

/** שדה בשורה: התנאים שלו מתייחסים לשדות של אותה שורה */
function RepeaterRowField(props: DynamicFieldProps) {
  const isVisible = useConditionsMet(props.control, props.field.condition);
  if (!isVisible) return null;

  if (props.field.type === "childrenList") {
    return (
      <FullRowCell name={props.field.name}>
        <ChildrenListField {...props} />
      </FullRowCell>
    );
  }

  return (
    <FieldCell field={props.field}>
      <AtomicField {...props} />
    </FieldCell>
  );
}
