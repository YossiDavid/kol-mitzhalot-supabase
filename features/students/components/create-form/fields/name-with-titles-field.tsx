"use client";

import { FormControl } from "@/components/ui/form";
import {
  InputGroup,
  InputGroupInput,
  InputGroupSelect,
} from "@/components/ui/input-group";
import type { FieldControlProps, FieldOption } from "./field-control-types";
import { FieldFrame } from "./field-frame";
import { isRecord, readOptionalString } from "./field-values";

const DEFAULT_TITLE_PLACEHOLDER = "תואר";

type NameParts = { prefix: string; name: string; suffix: string };

function ensureNamePartsValue(value: unknown): NameParts {
  if (!isRecord(value)) return { prefix: "", name: "", suffix: "" };
  const read = (part: unknown) => (typeof part === "string" ? part : "");
  return {
    prefix: read(value.prefix),
    name: read(value.name),
    suffix: read(value.suffix),
  };
}

/**
 * "textAndSelect": שם עם תואר לפני ואחרי. הערך נשמר כ-{ prefix, name, suffix }
 * תחת שם השדה; התוארים בתוך מסגרת השדה, והשם תופס את כל הרוחב שנשאר.
 */
export function NameWithTitlesField(props: FieldControlProps) {
  const { field, fieldId, label, placeholder, options, isDisabled } = props;
  const prefixOptions: FieldOption[] = Array.isArray(field.prefixOptions)
    ? field.prefixOptions
    : [];
  const prefixPlaceholder =
    readOptionalString(field.prefixPlaceholder) ?? DEFAULT_TITLE_PLACEHOLDER;
  const suffixPlaceholder = placeholder ?? DEFAULT_TITLE_PLACEHOLDER;

  return (
    <FieldFrame {...props} htmlFor={fieldId} isComposite>
      {(rhfField) => {
        const value = ensureNamePartsValue(rhfField.value);
        const updatePart = (key: keyof NameParts, nextValue: string) =>
          rhfField.onChange({ ...value, [key]: nextValue });

        return (
          <InputGroup>
            {prefixOptions.length > 0 && (
              <TitleSelect
                align="start"
                placeholder={prefixPlaceholder}
                ariaLabel={`${prefixPlaceholder}, ${label}`}
                value={value.prefix}
                options={prefixOptions}
                disabled={isDisabled}
                onChange={(next) => updatePart("prefix", next)}
              />
            )}
            <FormControl>
              <InputGroupInput
                id={fieldId}
                value={value.name}
                onChange={(event) => updatePart("name", event.target.value)}
                onBlur={rhfField.onBlur}
                ref={rhfField.ref}
                disabled={isDisabled}
              />
            </FormControl>
            <TitleSelect
              align="end"
              placeholder={suffixPlaceholder}
              ariaLabel={`${suffixPlaceholder}, ${label}`}
              value={value.suffix}
              options={options}
              disabled={isDisabled}
              onChange={(next) => updatePart("suffix", next)}
            />
          </InputGroup>
        );
      }}
    </FieldFrame>
  );
}

type TitleSelectProps = {
  align: "start" | "end";
  placeholder: string;
  ariaLabel: string;
  value: string;
  options: FieldOption[];
  disabled: boolean;
  onChange: (value: string) => void;
};

/** תואר לפני או אחרי השם, כתוספת קומפקטית בתוך מסגרת השדה */
function TitleSelect({
  align,
  placeholder,
  ariaLabel,
  value,
  options,
  disabled,
  onChange,
}: TitleSelectProps) {
  return (
    <InputGroupSelect
      align={align}
      // ריפוד מצומצם (החץ עדיין פנוי): במובייל כל פיקסל הולך לשם עצמו
      className="ps-2.5 pe-7"
      aria-label={ariaLabel}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    >
      {!value && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </InputGroupSelect>
  );
}
