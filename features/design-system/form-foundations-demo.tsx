"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Form, FormField } from "@/components/ui/form";
import { FormFieldShell } from "@/components/ui/form-field-shell";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupInput,
  InputGroupSelect,
} from "@/components/ui/input-group";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";

type DemoValues = { firstName: string; email: string };

const PREFIX_TITLES = ["הרב", "הר״ר", "הרה״ח"];
const SUFFIX_TITLES = ["הי״ו", "שליט״א", "ז״ל"];

/**
 * דוגמאות לרכיבי התשתית של שלב 0 (docs/design-refactor/PLAN.md): גובה אחיד
 * לשדה, רשימה נפתחת וכפתור; FormFieldShell במצב רגיל ובמצב שגיאה; ו-InputGroup
 * לשם עם תוארים.
 */
export function FormFoundationsDemo() {
  const form = useForm<DemoValues>({
    defaultValues: { firstName: "", email: "not-an-email" },
  });

  // מציג את מצב השגיאה של המעטפת בלי לחכות לשליחה
  useEffect(() => {
    form.setError("email", { message: "כתובת האימייל אינה תקינה" });
  }, [form]);

  return (
    <div className="grid max-w-2xl gap-6 rounded-xl border border-border bg-card p-5">
      <div className="space-y-2">
        <p className="text-caption text-muted-foreground">
          גובה אחיד: שדה, רשימה נפתחת וכפתור מתיישרים באותה שורה
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="w-40"
            placeholder="שדה טקסט"
            aria-label="שדה טקסט לדוגמה"
          />
          <NativeSelect
            className="w-40"
            aria-label="רשימה לדוגמה"
            defaultValue=""
          >
            <NativeSelectOption value="">בחרו מהרשימה</NativeSelectOption>
            <NativeSelectOption value="a">אפשרות א</NativeSelectOption>
          </NativeSelect>
          <Button>כפתור</Button>
          <Button variant="outline" size="sm">
            כפתור קטן
          </Button>
        </div>
      </div>

      <Form {...form}>
        <form
          className="grid gap-5 sm:grid-cols-2"
          onSubmit={(event) => event.preventDefault()}
        >
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormFieldShell
                label="שם פרטי"
                required
                description="כפי שמופיע בתעודת הזהות"
              >
                <Input {...field} />
              </FormFieldShell>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormFieldShell label="אימייל" description="לעדכונים על הצעות">
                <Input type="email" dir="ltr" {...field} />
              </FormFieldShell>
            )}
          />
        </form>
      </Form>

      <div className="space-y-2">
        <p className="text-caption text-muted-foreground">
          InputGroup: שם עם תואר לפני ואחרי, במסגרת אחת
        </p>
        <InputGroup>
          <InputGroupSelect aria-label="תואר לפני" defaultValue="הרב">
            {PREFIX_TITLES.map((title) => (
              <option key={title}>{title}</option>
            ))}
          </InputGroupSelect>
          <InputGroupInput placeholder="שם" aria-label="שם האב" />
          <InputGroupSelect
            align="end"
            aria-label="תואר אחרי"
            defaultValue="שליט״א"
          >
            {SUFFIX_TITLES.map((title) => (
              <option key={title}>{title}</option>
            ))}
          </InputGroupSelect>
        </InputGroup>
      </div>
    </div>
  );
}
