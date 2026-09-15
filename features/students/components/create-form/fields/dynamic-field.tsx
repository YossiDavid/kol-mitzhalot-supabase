"use client";

import React, { Fragment } from "react";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupInput,
  InputGroupSelect,
} from "@/components/ui/input-group";
import { Textarea } from "@/components/ui/textarea";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { SearchSelectField } from "./search-select-field";
import Upload from "./upload";
import { PhotoGalleryField } from "./photo-gallery-field";
import { Control, useFieldArray } from "react-hook-form";
import { cn } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import {
  FIELD_GRID_CLASS,
  FIELD_SCROLL_MARGIN_CLASS,
  FULL_ROW_CLASS,
  fieldCellAttributes,
  getFieldWidthClass,
} from "../field-layout";
import { formatFieldErrorMessage } from "../field-messages";

// bundle-dynamic-imports: lazy-load the heavy Jewish date picker so it's only
// bundled when a date field is actually rendered in the multi-step form
const ReactJewishDatePicker = dynamic(
  () =>
    import("@yossidavid/react-jewish-datepicker").then(
      (m) => m.ReactJewishDatePicker,
    ),
  { ssr: false },
);

type FieldMetadata = Record<string, any>;

export type DynamicFieldProps = {
  field: FieldMetadata;
  control: Control<any>;
  values: Record<string, any>;
  gender: "male" | "female" | "";
  getLabel: (field: FieldMetadata, gender: "male" | "female" | "") => string;
};

export function DynamicField({
  field,
  control,
  values,
  gender,
  getLabel,
}: DynamicFieldProps) {
  if (!shouldDisplayField(field, values)) {
    return null;
  }

  if (isRepeaterField(field)) {
    return (
      <div
        className={cn("col-span-12", FIELD_SCROLL_MARGIN_CLASS)}
        {...fieldCellAttributes(field.name)}
      >
        <RepeaterFieldRenderer
          field={field}
          control={control}
          values={values}
          gender={gender}
          getLabel={getLabel}
        />
      </div>
    );
  }

  // טקסט לפני השדה (למשל "לומד עם חברותא") בשורה משלו, כדי שהשדה ושכנו
  // בשורה יתיישרו לפי התוויות
  return (
    <Fragment>
      {renderBeforeField(field.beforeField ?? field.before)}
      <div
        className={cn(
          getFieldWidthClass(field.width),
          FIELD_SCROLL_MARGIN_CLASS,
        )}
        {...fieldCellAttributes(field.name)}
      >
        <AtomicFieldRenderer
          field={field}
          control={control}
          values={values}
          gender={gender}
          getLabel={getLabel}
        />
      </div>
    </Fragment>
  );
}

function AtomicFieldRenderer({
  field,
  control,
  values,
  gender,
  getLabel,
}: DynamicFieldProps) {
  const { type, name } = field;
  const rawField = field as FieldMetadata;
  const linkedIdPath: string | undefined =
    typeof rawField.linkedIdPath === "string"
      ? rawField.linkedIdPath
      : undefined;
  const isIdField = Boolean(rawField.isIdField);
  const linkedIdValue = linkedIdPath
    ? getValueByPath(values, linkedIdPath)
    : undefined;
  const disableBecauseLinkedId = !isIdField && hasNonEmptyValue(linkedIdValue);
  const placeholder: string | undefined = rawField.placeholder;
  const description: string | undefined = rawField.description;
  // לייבל של אפשרות יכול להיות מגדרי (״רווק.ה״ → ״רווק״ / ״רווקה״).
  // getLabel מטפל רק בלייבל של השדה, ולכן האפשרויות נפתרות כאן.
  const options: Array<{ value: string; label: string }> = (
    (rawField.options as Array<{
      value: string;
      label: string;
      labelFemale?: string;
      labelMale?: string;
    }>) ?? []
  ).map((option) => {
    const gendered =
      gender === "female"
        ? option.labelFemale
        : gender === "male"
          ? option.labelMale
          : undefined;
    return gendered ? { ...option, label: gendered } : option;
  });
  const isRequired = Boolean(rawField.required);
  const isVertical = Boolean(rawField.vertical);
  const emptyLabel: string | undefined = rawField.empty;
  const endpoint: string | undefined =
    typeof rawField.endpoint === "string" ? rawField.endpoint : undefined;
  const table: string | undefined =
    typeof rawField.table === "string" ? rawField.table : undefined;
  const valueColumn: string | undefined =
    typeof rawField.valueColumn === "string" ? rawField.valueColumn : undefined;
  const labelColumn: string | undefined =
    typeof rawField.labelColumn === "string" ? rawField.labelColumn : undefined;
  const searchColumn: string | undefined =
    typeof rawField.searchColumn === "string"
      ? rawField.searchColumn
      : undefined;
  const filters: Record<string, any> | undefined =
    typeof rawField.filters === "object" && rawField.filters !== null
      ? rawField.filters
      : undefined;
  const params: Record<string, any> | undefined =
    typeof rawField.params === "object" && rawField.params !== null
      ? rawField.params
      : undefined;
  const label = getLabel(field, gender);
  const fieldId = toFieldId(name);
  // הודעת שדה חובה כללית מהסכמה הופכת למשפט עם התווית שמוצגת (field-messages.ts)
  const formatMessage = (message: string) =>
    formatFieldErrorMessage(message, label, String(type));

  if (isTextAndSelectFieldType(type)) {
    const prefixOptions: Array<{ value: string; label: string }> =
      (rawField.prefixOptions as Array<{
        value: string;
        label: string;
      }>) ?? [];
    const prefixPlaceholder: string = rawField.prefixPlaceholder ?? "תואר";
    const suffixPlaceholder: string = placeholder ?? "תואר";
    return (
      <Fragment>
        <FormField
          control={control}
          name={name as any}
          render={({ field: rhfField }) => {
            const value = ensureNamePartsValue(rhfField.value);

            const updateFieldValue = (
              key: "prefix" | "name" | "suffix",
              nextValue: string,
            ) => {
              rhfField.onChange({
                ...value,
                [key]: nextValue,
              });
            };

            // הערך נשמר בדיוק כמו קודם: { prefix, name, suffix } תחת שם השדה.
            // התוארים בתוך מסגרת השדה, והשם תופס את כל הרוחב שנשאר.
            return (
              <FormItem>
                <FormLabel htmlFor={fieldId} required={isRequired}>
                  {label}
                </FormLabel>
                <InputGroup>
                  {prefixOptions.length > 0 && (
                    <TitleSelect
                      align="start"
                      placeholder={prefixPlaceholder}
                      ariaLabel={`${prefixPlaceholder}, ${label}`}
                      value={value.prefix}
                      options={prefixOptions}
                      disabled={disableBecauseLinkedId}
                      onChange={(next) => updateFieldValue("prefix", next)}
                    />
                  )}
                  <FormControl>
                    <InputGroupInput
                      id={fieldId}
                      value={value.name}
                      onChange={(event) =>
                        updateFieldValue("name", event.target.value)
                      }
                      onBlur={rhfField.onBlur}
                      ref={rhfField.ref}
                      disabled={disableBecauseLinkedId}
                    />
                  </FormControl>
                  <TitleSelect
                    align="end"
                    placeholder={suffixPlaceholder}
                    ariaLabel={`${suffixPlaceholder}, ${label}`}
                    value={value.suffix}
                    options={options}
                    disabled={disableBecauseLinkedId}
                    onChange={(next) => updateFieldValue("suffix", next)}
                  />
                </InputGroup>
                {description && (
                  <FormDescription>{description}</FormDescription>
                )}
                <FormMessage formatMessage={formatMessage} />
              </FormItem>
            );
          }}
        />
      </Fragment>
    );
  }

  if (isTextFieldType(type)) {
    return (
      <Fragment>
        <FormField
          control={control}
          name={name as any}
          render={({ field: rhfField }) => (
            <FormItem>
              <FormLabel htmlFor={fieldId} required={isRequired}>
                {label}
              </FormLabel>
              <FormControl>
                {type === "textarea" ? (
                  <Textarea
                    id={fieldId}
                    value={ensureStringValue(rhfField.value)}
                    onChange={(event) => rhfField.onChange(event.target.value)}
                    onBlur={rhfField.onBlur}
                    ref={rhfField.ref}
                    placeholder={placeholder}
                    className="min-h-[120px]"
                    disabled={disableBecauseLinkedId}
                  />
                ) : type === "date" ? (
                  <div
                    onClickCapture={(event) => {
                      const target = event.target as HTMLElement;
                      if (target.closest("button")) {
                        event.preventDefault();
                      }
                    }}
                    onMouseDownCapture={(event) => {
                      const target = event.target as HTMLElement;
                      if (target.closest("button")) {
                        event.preventDefault();
                      }
                    }}
                  >
                    <ReactJewishDatePicker
                      id={fieldId}
                      value={ensureStringValue(rhfField.value)}
                      input="file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-body shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-body-sm"
                      wrapperClassName="font-[ploni]"
                      calendarWrapper="absolute z-10 mt-1 w-full rounded-lg border bg-white p-2 shadow-lg scale-y-0 origin-top transition"
                      calendarWrapperOpen="scale-y-100"
                      calendar="w-full bg-white"
                      header="flex items-center justify-between py-2 px-1 bg-gray-100 rounded-t-md border-b border-gray-300"
                      navButton="p-1 rounded hover:bg-gray-200"
                      select="font-light"
                      weekdayHeader="mb-2 grid grid-cols-7 text-center text-caption font-bold text-gray-600"
                      dayCell="flex flex-col items-center justify-center rounded-md border px-2 py-2"
                      dayCellSelected="border-blue-500 bg-blue-100 font-bold"
                      dayCellOutsideMonth="opacity-50"
                      onChange={() => {
                        if (typeof window === "undefined") {
                          rhfField.onChange("");
                          return;
                        }
                        const updateValue = () => {
                          const inputEl = document.getElementById(
                            fieldId,
                          ) as HTMLInputElement | null;
                          const gregDate =
                            inputEl?.getAttribute("data-greg-date") ?? "";
                          rhfField.onChange(gregDate);
                        };

                        if (
                          typeof window.requestAnimationFrame === "function"
                        ) {
                          window.requestAnimationFrame(updateValue);
                        } else {
                          setTimeout(updateValue, 0);
                        }
                      }}
                    />
                  </div>
                ) : (
                  <Input
                    id={fieldId}
                    value={ensureStringValue(rhfField.value)}
                    onChange={(event) => rhfField.onChange(event.target.value)}
                    onBlur={rhfField.onBlur}
                    ref={rhfField.ref}
                    type={type === "number" ? "number" : "text"}
                    min={type === "number" ? rawField.min : undefined}
                    max={type === "number" ? rawField.max : undefined}
                    placeholder={placeholder}
                    disabled={disableBecauseLinkedId}
                  />
                )}
              </FormControl>
              {description && <FormDescription>{description}</FormDescription>}
              <FormMessage formatMessage={formatMessage} />
            </FormItem>
          )}
        />
      </Fragment>
    );
  }

  if (isSelectFieldType(type)) {
    if (type === "select2") {
      return (
        <Fragment>
          <FormField
            control={control}
            name={name as any}
            render={({ field: rhfField }) => (
              <FormItem>
                <FormLabel required={isRequired}>{label}</FormLabel>
                <FormControl>
                  <SearchSelectField
                    placeholder={placeholder ?? "חיפוש במאגר..."}
                    options={options}
                    empty={emptyLabel ?? "לא נמצאו תוצאות"}
                    value={ensureStringValue(rhfField.value)}
                    onChange={rhfField.onChange}
                    endpoint={endpoint}
                    table={table}
                    valueColumn={valueColumn}
                    labelColumn={labelColumn}
                    searchColumn={searchColumn}
                    filters={filters}
                    params={params}
                    disabled={disableBecauseLinkedId}
                  />
                </FormControl>
                <FormMessage formatMessage={formatMessage} />
              </FormItem>
            )}
          />
        </Fragment>
      );
    }

    if (type === "checkbox") {
      return (
        <Fragment>
          <FormField
            control={control}
            name={name as any}
            render={({ field: rhfField }) => {
              const currentValue = ensureStringArray(rhfField.value);

              const toggleValue = (optionValue: string) => {
                if (currentValue.includes(optionValue)) {
                  rhfField.onChange(
                    currentValue.filter((value) => value !== optionValue),
                  );
                } else {
                  rhfField.onChange([...currentValue, optionValue]);
                }
              };

              return (
                <FormItem className="space-y-3">
                  <FormLabel required={isRequired}>{label}</FormLabel>
                  <FormControl>
                    <div
                      className={cn(
                        // זהה למרווח של הרדיו, כדי ששתי
                        // קבוצות הבחירה ייראו אותו דבר.
                        "flex flex-wrap gap-x-7 gap-y-3",
                        isVertical && "flex-col flex-nowrap gap-y-3",
                      )}
                    >
                      {options.map((option) => (
                        <label
                          key={option.value}
                          className="flex items-center gap-2"
                        >
                          <Checkbox
                            checked={currentValue.includes(option.value)}
                            onCheckedChange={() => {
                              if (disableBecauseLinkedId) {
                                return;
                              }
                              toggleValue(option.value);
                            }}
                            disabled={disableBecauseLinkedId}
                          />
                          <span>{option.label}</span>
                        </label>
                      ))}
                    </div>
                  </FormControl>
                  <FormMessage formatMessage={formatMessage} />
                </FormItem>
              );
            }}
          />
        </Fragment>
      );
    }

    if (type === "radio") {
      return (
        <Fragment>
          <FormField
            control={control}
            name={name as any}
            render={({ field: rhfField }) => (
              <FormItem className="space-y-3">
                <FormLabel required={isRequired}>{label}</FormLabel>
                <FormControl>
                  <div
                    className={cn(
                      // מרווח אופקי גדול מהמרווח שבין הכפתור לטקסט,
                      // כדי שגבול הפריט יהיה ברור כשהשורה נשברת.
                      "flex flex-wrap gap-x-7 gap-y-3",
                      isVertical && "flex-col flex-nowrap gap-y-3",
                    )}
                  >
                    {options.map((option) => (
                      <label
                        key={option.value}
                        className="flex items-center gap-2"
                      >
                        <input
                          type="radio"
                          value={option.value}
                          checked={
                            ensureStringValue(rhfField.value) === option.value
                          }
                          onChange={() => {
                            if (disableBecauseLinkedId) {
                              return;
                            }
                            rhfField.onChange(option.value);
                          }}
                          className="size-4 accent-primary"
                          disabled={disableBecauseLinkedId}
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                </FormControl>
                <FormMessage formatMessage={formatMessage} />
              </FormItem>
            )}
          />
        </Fragment>
      );
    }

    if (type === "chips" || type === "chip") {
      return (
        <Fragment>
          <FormField
            control={control}
            name={name as any}
            render={({ field: rhfField }) => {
              const currentValue = ensureStringArray(rhfField.value);

              const toggleChip = (value: string) => {
                if (disableBecauseLinkedId) {
                  return;
                }

                if (currentValue.includes(value)) {
                  rhfField.onChange(
                    currentValue.filter((item) => item !== value),
                  );
                } else {
                  rhfField.onChange([...currentValue, value]);
                }
              };

              return (
                <FormItem className="space-y-3">
                  <FormLabel required={isRequired}>{label}</FormLabel>
                  <FormControl>
                    <div className="flex flex-wrap gap-2">
                      {options.map((option) => {
                        const isActive = currentValue.includes(option.value);
                        return (
                          <Button
                            type="button"
                            key={option.value}
                            variant={isActive ? "default" : "outline"}
                            onClick={() => toggleChip(option.value)}
                            disabled={disableBecauseLinkedId}
                            className="rounded-full px-4"
                          >
                            {option.label}
                          </Button>
                        );
                      })}
                    </div>
                  </FormControl>
                  <FormMessage formatMessage={formatMessage} />
                </FormItem>
              );
            }}
          />
        </Fragment>
      );
    }

    if (type === "inputAndSelect") {
      return null;
    }

    return (
      <Fragment>
        <FormField
          control={control}
          name={name as any}
          render={({ field: rhfField }) => {
            const currentValue = ensureStringValue(rhfField.value);
            const placeholderText = placeholder ?? "בחרו מהרשימה";

            return (
              <FormItem>
                <FormLabel required={isRequired}>{label}</FormLabel>
                <FormControl>
                  <NativeSelect
                    value={currentValue}
                    onChange={(e) => rhfField.onChange(e.target.value)}
                    onBlur={rhfField.onBlur}
                    disabled={disableBecauseLinkedId}
                  >
                    {!currentValue && (
                      <NativeSelectOption value="" disabled>
                        {placeholderText}
                      </NativeSelectOption>
                    )}
                    {options.map((option) => (
                      <NativeSelectOption
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </FormControl>
                <FormMessage formatMessage={formatMessage} />
              </FormItem>
            );
          }}
        />
      </Fragment>
    );
  }

  if (isRangeFieldType(type)) {
    return (
      <Fragment>
        <FormField
          control={control}
          name={name as any}
          render={({ field: rhfField }) => {
            const storeAsObject = isRecord(rhfField.value);
            const value = ensureRangeTuple(rhfField.value, [18, 40]);

            const updateValue = (index: number, next: number) => {
              const [minValue, maxValue] = value;
              if (storeAsObject) {
                const nextPayload = {
                  min: index === 0 ? next : minValue,
                  max: index === 1 ? next : maxValue,
                };
                rhfField.onChange(nextPayload);
              } else {
                const nextRange = [...value] as [number, number];
                nextRange[index] = next;
                rhfField.onChange(nextRange);
              }
            };

            return (
              <FormItem>
                <FormLabel required={isRequired}>{label}</FormLabel>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    value={value[0]}
                    onChange={(event) =>
                      !disableBecauseLinkedId &&
                      updateValue(0, Number(event.target.value))
                    }
                    disabled={disableBecauseLinkedId}
                  />
                  <span>עד</span>
                  <Input
                    type="number"
                    value={value[1]}
                    onChange={(event) =>
                      !disableBecauseLinkedId &&
                      updateValue(1, Number(event.target.value))
                    }
                    disabled={disableBecauseLinkedId}
                  />
                </div>
                <FormMessage formatMessage={formatMessage} />
              </FormItem>
            );
          }}
        />
      </Fragment>
    );
  }

  if (isPhotoGalleryFieldType(type)) {
    return (
      <Fragment>
        <FormField
          control={control}
          name={name as any}
          render={({ field: rhfField }) => (
            <FormItem>
              <FormLabel required={isRequired}>{label}</FormLabel>
              <FormControl>
                <PhotoGalleryField
                  value={Array.isArray(rhfField.value) ? rhfField.value : []}
                  onChange={rhfField.onChange}
                />
              </FormControl>
              {description && <FormDescription>{description}</FormDescription>}
              <FormMessage formatMessage={formatMessage} />
            </FormItem>
          )}
        />
      </Fragment>
    );
  }

  if (isUploadFieldType(type)) {
    const isMultiUpload = name.endsWith(".documents");

    return (
      <Fragment>
        <FormField
          control={control}
          name={name as any}
          render={({ field: rhfField }) => {
            const files: File[] = (() => {
              if (isMultiUpload) {
                return Array.isArray(rhfField.value)
                  ? (rhfField.value as File[])
                  : [];
              }

              if (isRecord(rhfField.value)) {
                const singleFile = (rhfField.value as Record<string, unknown>)
                  .file;
                return singleFile instanceof File ? [singleFile] : [];
              }

              return [];
            })();

            const handleFilesChange = (nextFiles: File[]) => {
              if (isMultiUpload) {
                rhfField.onChange(nextFiles);
              } else {
                const base = isRecord(rhfField.value)
                  ? (rhfField.value as Record<string, unknown>)
                  : {};
                rhfField.onChange({
                  ...base,
                  file: nextFiles[0] ?? null,
                });
              }
            };

            return (
              <FormItem>
                <FormLabel required={isRequired}>{label}</FormLabel>
                <FormControl>
                  <Upload
                    accept={rawField.accept}
                    multiple={isMultiUpload}
                    value={files}
                    onChange={handleFilesChange}
                  />
                </FormControl>
                {description && (
                  <FormDescription>{description}</FormDescription>
                )}
                <FormMessage formatMessage={formatMessage} />
              </FormItem>
            );
          }}
        />
      </Fragment>
    );
  }

  return null;
}

type TitleSelectProps = {
  align: "start" | "end";
  placeholder: string;
  ariaLabel: string;
  value: string;
  options: Array<{ value: string; label: string }>;
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

type RepeaterFieldRendererProps = {
  field: FieldMetadata;
  control: Control<any>;
  values: Record<string, any>;
  gender: "male" | "female" | "";
  getLabel: (field: FieldMetadata, gender: "male" | "female" | "") => string;
};

function RepeaterFieldRenderer({
  field,
  control,
  values,
  gender,
  getLabel,
}: RepeaterFieldRendererProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: field.name as any,
  });

  const template = React.useMemo(() => createRepeaterTemplate(field), [field]);

  const handleAdd = () => {
    append(deepClone(template));
  };

  const beforeField = field.beforeField ?? field.before;
  const itemLabel = readText(field.itemLabel, "רשומה");
  const addLabel = readText(field.addLabel, "הוספת רשומה");
  const emptyText = readText(field.emptyText, "אין רשומות עדיין.");

  return (
    <div className="space-y-4">
      {renderBeforeField(beforeField, { inGrid: false })}
      {fields.length === 0 && (
        <p className="text-body-sm text-muted-foreground">{emptyText}</p>
      )}

      <ol className="space-y-4 empty:hidden">
        {fields.map((item, index) => {
          const idFieldPaths = new Set(
            field.fileds
              .filter(
                (candidate: FieldMetadata) =>
                  typeof candidate.name === "string" &&
                  getLastPathSegment(
                    (candidate.originalName ?? candidate.name) as string,
                  ) === "id",
              )
              .map((candidate: FieldMetadata) =>
                resolveFieldName(candidate.name as string, field.name, index),
              ),
          );

          const itemTitle = `${itemLabel} ${index + 1}`;

          return (
            <li key={item.id} className="rounded-lg border border-border p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-label font-bold">{itemTitle}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`מחיקת ${itemTitle}`}
                  onClick={() => remove(index)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
              <div className={FIELD_GRID_CLASS}>
                {field.fileds.map((innerField: FieldMetadata) => {
                  const resolvedName = resolveFieldName(
                    innerField.name,
                    field.name,
                    index,
                  );
                  const innerFieldAny = innerField as FieldMetadata;
                  const adjustedConditions = innerFieldAny.condition?.map(
                    (condition: any) => ({
                      ...condition,
                      parameter: resolveFieldName(
                        condition.parameter,
                        field.name,
                        index,
                      ),
                    }),
                  );

                  const linkedIdPath = determineLinkedIdPath(
                    resolvedName,
                    idFieldPaths as any,
                  );

                  const innerFieldConfig = {
                    ...innerFieldAny,
                    name: resolvedName,
                    condition: adjustedConditions,
                    originalName:
                      innerFieldAny.originalName ?? innerFieldAny.name,
                    isIdField: idFieldPaths.has(resolvedName),
                    linkedIdPath,
                  };

                  if (!shouldDisplayField(innerFieldConfig, values)) {
                    return null;
                  }

                  return (
                    <Fragment
                      key={innerFieldAny.originalName ?? innerFieldAny.name}
                    >
                      {renderBeforeField(
                        innerFieldAny.beforeField ?? innerFieldAny.before,
                      )}
                      <div
                        className={cn(
                          getFieldWidthClass(innerFieldAny.width),
                          FIELD_SCROLL_MARGIN_CLASS,
                        )}
                        {...fieldCellAttributes(resolvedName)}
                      >
                        <AtomicFieldRenderer
                          field={innerFieldConfig}
                          control={control}
                          values={values}
                          gender={gender}
                          getLabel={getLabel}
                        />
                      </div>
                    </Fragment>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ol>

      <Button type="button" variant="outline" onClick={handleAdd}>
        <Plus aria-hidden />
        <span>{addLabel}</span>
      </Button>
    </div>
  );
}

function readText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

const HTML_TAG_PATTERN = /<[a-z][\s\S]*>/i;

/**
 * טקסט שמופיע לפני שדה. ברשת הוא שורה מלאה משלו: HTML (פתיח הטופס) כמו
 * שהוא, וטקסט רגיל ככותרת קטנה של קבוצת השדות שאחריו.
 */
function renderBeforeField(
  beforeField: React.ReactNode,
  { inGrid = true }: { inGrid?: boolean } = {},
) {
  if (!beforeField) {
    return null;
  }

  const rowClass = inGrid ? FULL_ROW_CLASS : undefined;

  if (typeof beforeField === "string" && HTML_TAG_PATTERN.test(beforeField)) {
    return (
      <div
        dangerouslySetInnerHTML={{ __html: beforeField }}
        className={cn(rowClass, "space-y-2 [&>hr]:mt-7")}
      />
    );
  }

  if (typeof beforeField === "string") {
    // קרוב לשדה שהוא מתאר: חצי מהמרווח בין שורות
    return (
      <p className={cn(rowClass, "-mb-3 text-label font-bold")}>
        {beforeField}
      </p>
    );
  }

  return <div className={rowClass}>{beforeField}</div>;
}

function determineLinkedIdPath(fieldName: string, idFieldPaths: Set<string>) {
  if (idFieldPaths.size === 0) {
    return undefined;
  }

  if (idFieldPaths.has(fieldName)) {
    return fieldName;
  }

  const parentPath = getParentPath(fieldName);
  if (!parentPath) {
    return undefined;
  }

  const candidate = `${parentPath}.id`;
  return idFieldPaths.has(candidate) ? candidate : undefined;
}

function shouldDisplayField(field: FieldMetadata, values: Record<string, any>) {
  if (!field.condition || field.condition.length === 0) {
    return true;
  }

  return field.condition.every((condition: any) => {
    const compareValue = getValueByPath(values, condition.parameter);
    switch (condition.operator) {
      case "===":
        return compareValue === condition.value;
      case "!==":
        return compareValue !== condition.value;
      case "includes":
        return Array.isArray(compareValue)
          ? compareValue.includes(condition.value)
          : typeof compareValue === "string" &&
              compareValue.includes(condition.value);
      case "in":
        return (
          Array.isArray(condition.value) &&
          condition.value.includes(String(compareValue ?? ""))
        );
      default:
        return true;
    }
  });
}

function getParentPath(path: string) {
  const normalized = path.replace(/\[(\d+)\]/g, ".$1");
  const segments = normalized.split(".").filter(Boolean);
  segments.pop();
  return segments.join(".");
}

function getLastPathSegment(path: string) {
  const normalized = path.replace(/\[(\d+)\]/g, ".$1");
  const segments = normalized.split(".").filter(Boolean);
  return segments[segments.length - 1] ?? "";
}

function isRepeaterField(field: FieldMetadata) {
  return field.type === "repeater";
}

function isTextFieldType(type: unknown) {
  return ["text", "number", "date", "textarea", "switch"].includes(
    String(type),
  );
}

function isSelectFieldType(type: unknown) {
  return [
    "select",
    "select2",
    "chips",
    "chip",
    "inputAndSelect",
    "checkbox",
    "radio",
  ].includes(String(type));
}

function isTextAndSelectFieldType(type: unknown) {
  return String(type) === "textAndSelect";
}

function isRangeFieldType(type: unknown) {
  return ["range", "rangeDouble"].includes(String(type));
}

function isUploadFieldType(type: unknown) {
  return String(type) === "upload";
}

function isPhotoGalleryFieldType(type: unknown) {
  return String(type) === "photos";
}

function toFieldId(name: string) {
  return name.replace(/[^a-zA-Z0-9]+/g, "-");
}

function ensureStringValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  return "";
}

function ensureStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }
  return [];
}

function ensureNamePartsValue(value: unknown): {
  prefix: string;
  name: string;
  suffix: string;
} {
  if (isRecord(value)) {
    const prefixValue = value["prefix"];
    const nameValue = value["name"];
    const suffixValue = value["suffix"];
    const prefix = typeof prefixValue === "string" ? prefixValue : "";
    const name = typeof nameValue === "string" ? nameValue : "";
    const suffix = typeof suffixValue === "string" ? suffixValue : "";
    return { prefix, name, suffix };
  }
  return { prefix: "", name: "", suffix: "" };
}

function ensureRangeTuple(
  value: unknown,
  fallback: [number, number],
): [number, number] {
  if (isRecord(value)) {
    const minValue = value["min"];
    const maxValue = value["max"];
    if (typeof minValue === "number" && typeof maxValue === "number") {
      return [minValue, maxValue];
    }
  }

  if (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((item) => typeof item === "number")
  ) {
    return [value[0], value[1]] as [number, number];
  }
  return fallback;
}

function resolveFieldName(baseName: string, arrayName: string, index: number) {
  if (baseName === arrayName) {
    return `${arrayName}.${index}`;
  }

  if (baseName.startsWith(`${arrayName}.`)) {
    const suffix = baseName.slice(arrayName.length + 1);
    return `${arrayName}.${index}.${suffix}`;
  }

  return baseName;
}

function normalizePath(path: string) {
  return path.replace(/\[\d+\]/g, "");
}

function getValueByPath(source: Record<string, any>, path: string) {
  if (!path) return undefined;
  const segments = path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean);

  return segments.reduce<any>((acc, segment) => {
    if (acc == null) return undefined;
    return acc[segment];
  }, source);
}

function hasNonEmptyValue(value: unknown) {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (typeof value === "number") {
    return !Number.isNaN(value);
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).length > 0;
  }

  return false;
}

function createRepeaterTemplate(field: FieldMetadata) {
  const template: Record<string, any> = {};
  field.fileds.forEach((innerField: FieldMetadata) => {
    const originalName = innerField.originalName ?? innerField.name;
    let relativePath = originalName;
    if (originalName === field.name) {
      relativePath = "";
    } else if (originalName.startsWith(`${field.name}.`)) {
      relativePath = originalName.slice(field.name.length + 1);
    }

    if (!relativePath) {
      return;
    }

    setNestedValue(template, relativePath, getDefaultValueForField(innerField));
  });
  return template;
}

function getDefaultValueForField(field: FieldMetadata) {
  switch (field.type) {
    case "chip":
    case "chips":
    case "checkbox":
      return [];
    case "range":
    case "rangeDouble":
      return [0, 0];
    case "switch":
      return false;
    case "upload":
      return field.name.endsWith(".documents") ? [] : { file: null };
    case "textAndSelect":
      return { prefix: "", name: "", suffix: "" };
    default:
      return "";
  }
}

function setNestedValue(target: Record<string, any>, path: string, value: any) {
  if (!path) {
    return;
  }

  const segments = path.split(".");
  let current = target;

  segments.forEach((segment, index) => {
    if (index === segments.length - 1) {
      current[segment] = value;
    } else {
      current[segment] = current[segment] ?? {};
      current = current[segment];
    }
  });

  return target;
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
