"use client";

import { useFormContext } from "react-hook-form";

import type { FieldControlProps } from "./field-control-types";
import { FieldFrame } from "./field-frame";
import {
  ensureStringValue,
  getParentPath,
  readOptionalString,
  readRecord,
} from "./field-values";
import { SearchSelectField } from "./search-select-field";

const DEFAULT_PLACEHOLDER = "חיפוש במאגר...";
const DEFAULT_EMPTY_TEXT = "לא נמצאו תוצאות";

/** "select2": חיפוש במאגר (טבלה ב-Supabase או endpoint) */
export function SearchSelectFormField(props: FieldControlProps) {
  const { field, name, placeholder, options, isDisabled } = props;
  const { setValue } = useFormContext();
  const fillOnSelect = readRecord<string>(field.fillOnSelect);

  // בחירה ממלאת שדות באותה שורה מעמודות הטבלה (fillOnSelect ב-fields-data)
  const handleSelectRow = fillOnSelect
    ? (row: Record<string, unknown> | null) => {
        if (!row) return;
        const rowPath = getParentPath(name);
        Object.entries(fillOnSelect).forEach(([siblingName, column]) =>
          setValue(`${rowPath}.${siblingName}`, ensureStringValue(row[column]), {
            shouldDirty: true,
          }),
        );
      }
    : undefined;

  return (
    <FieldFrame {...props}>
      {(rhfField) => (
        <SearchSelectField
          placeholder={placeholder ?? DEFAULT_PLACEHOLDER}
          options={options}
          empty={readOptionalString(field.empty) ?? DEFAULT_EMPTY_TEXT}
          value={ensureStringValue(rhfField.value)}
          onChange={rhfField.onChange}
          endpoint={readOptionalString(field.endpoint)}
          table={readOptionalString(field.table)}
          valueColumn={readOptionalString(field.valueColumn)}
          labelColumn={readOptionalString(field.labelColumn)}
          searchColumn={readOptionalString(field.searchColumn)}
          filters={readRecord(field.filters)}
          params={readRecord(field.params)}
          extraColumns={fillOnSelect && Object.values(fillOnSelect)}
          onSelectRow={handleSelectRow}
          disabled={isDisabled}
        />
      )}
    </FieldFrame>
  );
}
