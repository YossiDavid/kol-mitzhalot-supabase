"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Route } from "next";
import Link from "next/link";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { FormActions, FormFields } from "@/components/ui/form-layout";
import { ShadchanProfileFields } from "@/features/shadchanim/components/shadchan-profile-fields";
import {
  shadchanProfileSchema,
  type ShadchanFormData,
} from "@/features/shadchanim/lib/profile-form";

interface ShadchanProfileFormCardProps {
  title: string;
  description: string;
  defaultValues: ShadchanFormData;
  submitLabel: string;
  pendingLabel: string;
  cancelHref: Route;
  /** השמירה בפועל; אחראית להודעות ולניווט (שגיאה: להציג הודעה ולא לזרוק) */
  onSubmit: (data: ShadchanFormData) => Promise<void>;
}

/** כרטיס הטופס המשותף: הצטרפות, עריכה עצמית ועריכת מנהל. */
export function ShadchanProfileFormCard({
  title,
  description,
  defaultValues,
  submitLabel,
  pendingLabel,
  cancelHref,
  onSubmit,
}: ShadchanProfileFormCardProps) {
  const form = useForm<ShadchanFormData>({
    resolver: zodResolver(shadchanProfileSchema),
    defaultValues,
  });
  const { isSubmitting } = form.formState;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          {/* noValidate: ההודעות בעברית מגיעות מהסכמה ולא מהדפדפן */}
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <FormFields>
              <ShadchanProfileFields
                control={form.control}
                isSubmitting={isSubmitting}
              />
              <FormActions>
                <Button
                  type="button"
                  variant="outline"
                  asChild
                  disabled={isSubmitting}
                >
                  <Link href={cancelHref}>ביטול</Link>
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? pendingLabel : submitLabel}
                </Button>
              </FormActions>
            </FormFields>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
