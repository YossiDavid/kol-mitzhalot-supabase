"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Page, PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField } from "@/components/ui/form";
import { FormFieldShell } from "@/components/ui/form-field-shell";
import {
  FormActions,
  FormFields,
  FormGrid,
  FormSubmitError,
} from "@/components/ui/form-layout";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  optionalText,
  requiredEmail,
  requiredPhone,
} from "@/lib/forms/schema";

const ROLE_LABELS = {
  user: "משתמש",
  shadchan: "שדכן",
  admin: "מנהל מערכת",
} as const;

type Role = keyof typeof ROLE_LABELS;

const ROLE_VALUES = Object.keys(ROLE_LABELS) as [Role, ...Role[]];

const createUserSchema = z.object({
  firstName: optionalText(),
  lastName: optionalText(),
  email: requiredEmail("אימייל"),
  phone: requiredPhone("טלפון"),
  role: z.enum(ROLE_VALUES),
});

type CreateUserValues = z.infer<typeof createUserSchema>;

export default function CreateAdminUserPage() {
  const router = useRouter();

  const form = useForm<CreateUserValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      role: "user",
    },
  });

  const { isSubmitting, errors } = form.formState;

  const onSubmit = async (values: CreateUserValues) => {
    form.clearErrors("root");

    try {
      const response = await fetch("/api/v1/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: values.firstName || null,
          lastName: values.lastName || null,
          email: values.email,
          phone: values.phone,
          role: values.role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        form.setError("root", {
          message:
            data?.error ||
            "אירעה שגיאה בעת יצירת המשתמש. נסה/י שוב מאוחר יותר.",
        });
        return;
      }

      // ניתוב לדף פרטי המשתמש החדש אם קיים מזהה, אחרת חזרה לרשימה
      if (data?.id) {
        router.push(`/app/admin/users/${data.id}`);
      } else {
        router.push("/app/admin/users");
      }
    } catch (error) {
      console.error("Error creating user:", error);
      form.setError("root", {
        message: "אירעה שגיאה לא צפויה בעת יצירת המשתמש",
      });
    }
  };

  return (
    <Page width="form">
      <PageHeader
        title="יצירת משתמש חדש"
        description="הוספת משתמש חדש למערכת"
        actions={
          <Button asChild variant="outline">
            <Link href="/app/admin/users">חזרה לרשימת המשתמשים</Link>
          </Button>
        }
      />
      <Card>
        <CardContent>
          <Form {...form}>
            {/* noValidate: ההודעות בעברית מגיעות מהסכמה ולא מהדפדפן */}
            <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
              <FormFields>
                <FormSubmitError>{errors.root?.message}</FormSubmitError>

                <FormGrid>
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormFieldShell label="שם פרטי">
                        <Input
                          {...field}
                          placeholder="לדוגמה: ישראל"
                          autoComplete="off"
                          disabled={isSubmitting}
                        />
                      </FormFieldShell>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormFieldShell label="שם משפחה">
                        <Input
                          {...field}
                          placeholder="לדוגמה: כהן"
                          autoComplete="off"
                          disabled={isSubmitting}
                        />
                      </FormFieldShell>
                    )}
                  />
                </FormGrid>

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormFieldShell label="אימייל" required>
                      <Input
                        {...field}
                        type="email"
                        placeholder="user@example.com"
                        autoComplete="off"
                        disabled={isSubmitting}
                      />
                    </FormFieldShell>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormFieldShell label="טלפון" required>
                      <Input
                        {...field}
                        type="tel"
                        placeholder="לדוגמה: 050-0000000"
                        autoComplete="off"
                        dir="ltr"
                        className="text-start"
                        disabled={isSubmitting}
                      />
                    </FormFieldShell>
                  )}
                />

                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormFieldShell label="תפקיד במערכת" required isComposite>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={isSubmitting}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="בחר תפקיד" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ROLE_VALUES.map((role) => (
                            <SelectItem key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormFieldShell>
                  )}
                />

                <FormActions>
                  <Button
                    type="button"
                    variant="outline"
                    asChild
                    disabled={isSubmitting}
                  >
                    <Link href="/app/admin/users">ביטול</Link>
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "יוצר משתמש..." : "יצירת משתמש"}
                  </Button>
                </FormActions>
              </FormFields>
            </form>
          </Form>
        </CardContent>
      </Card>
    </Page>
  );
}
