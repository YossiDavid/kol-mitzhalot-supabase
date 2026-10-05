import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

interface FormFieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  children: ReactNode;
}

/** מזהה אלמנט השגיאה/הרמז - מחובר לשדה ב-aria-describedby */
export const fieldDescriptionId = (id: string) => `${id}-description`;

/** תווית + שדה + רמז/שגיאה בעברית, עם role=alert לשגיאה */
export function FormField({
  id,
  label,
  error,
  hint,
  optional,
  children,
}: FormFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>
        {label}
        {optional && (
          <span className="ms-1 font-normal text-muted-foreground">
            (לא חובה)
          </span>
        )}
      </Label>
      {children}
      {error ? (
        <p
          id={fieldDescriptionId(id)}
          role="alert"
          className="text-caption text-destructive"
        >
          {error}
        </p>
      ) : hint ? (
        <p
          id={fieldDescriptionId(id)}
          className="text-caption text-muted-foreground"
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}
