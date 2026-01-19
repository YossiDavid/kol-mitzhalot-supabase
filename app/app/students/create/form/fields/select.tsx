import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { SelectField as SelectFieldType } from "../fileds-data";
import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";

type Option = SelectFieldType["options"][number];

type ShadcnSelectProps = {
  type: "select";
  options: Option[];
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  // כל דבר עיצובי/עזר:
  className?: string;
  label?: string;
};

type Select2Props = {
  type: "select2";
  placeholder?: string;
  className?: string;
  label?: string;
  value?: string;
  onChange?: (value: string) => void;
};

type SelectFieldProps = SelectFieldType;

export function SelectField(props: SelectFieldProps) {
  if (props.type === "select") {
    const {
      options,
      placeholder = "בחירה",
      value,
      onChange,
      className,
    } = props;
    return (
      <Select>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option: Option) => (
            <SelectItem value={option.value} key={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (props.type === "select2") {
    const {
      placeholder = "כתוב כאן...",
      options,
      empty,
      className,
      value,
      onChange,
      endpoint,
    } = props;
    return (
      <Combobox
        placeholder={placeholder}
        options={options ?? []}
        empty={empty || "לא נמצאו פריטים"}
        value={value}
        onChange={onChange}
        className={className}
      />
    );
  }

  if (props.type === "checkbox") {
    const {
      className,
      options = [],
      id = "chk",
      value = [],
      vertical = false,
      onChange, // תדאג שיגיע מבחוץ
    } = props;

    return (
      <div
        className={cn(
          "flex",
          vertical ? "flex-col gap-2" : "flex-row flex-wrap gap-4",
          className,
        )}
      >
        {options.map((option, index) => {
          const inputId = `${id}-${index}`;
          // const checked = value.includes?.(option.value)

          return (
            <div
              key={option.value ?? index}
              className="inline-flex items-center gap-2"
            >
              <Checkbox
                id={inputId}
              // checked={!!checked}
              // onCheckedChange={(checked) => {
              // 	if (!onChange) return
              // 	onChange(
              // 		checked
              // 			? [...value, option.value]
              // 			: value.filter(
              // 					(v: string) =>
              // 						v !== option.value
              // 			  )
              // 	)
              // }}
              />
              <Label htmlFor={inputId}>{option.label}</Label>
            </div>
          );
        })}
      </div>
    );
  }

  if (props.type === "radio") {
    const { className, options, id, value } = props;
    return (
      <>
        {options.map((option: Option, index) => (
          <>
            <Checkbox
            // checked={value?.includes(option.value || "")}
            // onCheckedChange={(checked) => {
            // 	return checked
            // 		? field.onChange([...field.value, item.id])
            // 		: field.onChange(
            // 				field.value?.filter(
            // 					(value) => value !== item.id
            // 				)
            // 		  )
            // }}
            />
            <Label>{option.label}</Label>
          </>
        ))}
      </>
    );
  }

  // "chips",
  // "chip",
  // "inputAndSelect",

  // fallback (לא צפוי להגיע לכאן)
  return null;
}
