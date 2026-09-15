"use client";

import type { ComponentType } from "react";

import { formatFieldErrorMessage } from "../field-messages";
import { useHasValueAt } from "../use-form-conditions";
import { CheckboxField } from "./checkbox-field";
import { ChipsField } from "./chips-field";
import type {
  DynamicFieldProps,
  FieldControlProps,
} from "./field-control-types";
import { DateField } from "./date-field";
import {
  readOptionalString,
  resolveGenderedOptions,
  toFieldId,
} from "./field-values";
import { NameWithTitlesField } from "./name-with-titles-field";
import { NativeSelectField } from "./native-select-field";
import { PhotosField } from "./photos-field";
import { RadioField } from "./radio-field";
import { RangeField } from "./range-field";
import { SearchSelectFormField } from "./search-select-form-field";
import { TextInputField } from "./text-input-field";
import { TextareaField } from "./textarea-field";
import { UploadFormField } from "./upload-field";

/** סוג שדה → הרכיב שלו. סוג שלא מופיע כאן (למשל inputAndSelect) לא מוצג */
const FIELD_COMPONENTS: Readonly<
  Record<string, ComponentType<FieldControlProps>>
> = {
  text: TextInputField,
  number: TextInputField,
  switch: TextInputField,
  textarea: TextareaField,
  date: DateField,
  textAndSelect: NameWithTitlesField,
  select: NativeSelectField,
  select2: SearchSelectFormField,
  radio: RadioField,
  checkbox: CheckboxField,
  chips: ChipsField,
  chip: ChipsField,
  range: RangeField,
  rangeDouble: RangeField,
  photos: PhotosField,
  upload: UploadFormField,
};

/**
 * שדה בודד (לא רשומה חוזרת): מחשב את מה שמשותף לכל הסוגים - תווית לפי מגדר,
 * id, חובה, נעילה לפי בורר המאגר בשורה ונוסח השגיאה - ומעביר לרכיב של הסוג.
 */
export function AtomicField({
  field,
  control,
  gender,
  getLabel,
}: DynamicFieldProps) {
  // שדה בשורה ננעל כשבאותה שורה נבחרה רשומה מתוך המאגר
  const hasLinkedId = useHasValueAt(
    control,
    readOptionalString(field.linkedIdPath),
  );
  const type = String(field.type);
  const Component = FIELD_COMPONENTS[type];
  if (!Component) return null;

  const name: string = field.name;
  const label = getLabel(field, gender);

  return (
    <Component
      field={field}
      control={control}
      name={name}
      fieldId={toFieldId(name)}
      label={label}
      isRequired={Boolean(field.required)}
      isDisabled={!field.isIdField && hasLinkedId}
      placeholder={readOptionalString(field.placeholder)}
      description={readOptionalString(field.description)}
      options={resolveGenderedOptions(field.options, gender)}
      formatMessage={(message) => formatFieldErrorMessage(message, label, type)}
    />
  );
}
