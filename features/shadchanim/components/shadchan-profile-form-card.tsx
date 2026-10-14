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
import { ShadchanCardPreview } from "@/features/shadchanim/components/shadchan-card-preview";
import { ShadchanProfileFields } from "@/features/shadchanim/components/shadchan-profile-fields";
import type { PreviewIdentity } from "@/features/shadchanim/lib/preview-card";
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
  /** מי מוצג בתצוגה המקדימה של הכרטיס (שם ותמונה אינם בטופס) */
  previewIdentity: PreviewIdentity;
  /** "למה כדאי לאשר אותי" - רק כשהבקשה עדיין בבדיקה, או למנהל */
  showApplicationNote?: boolean;
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
  previewIdentity,
  showApplicationNote = false,
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
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-x-8">
              <FormFields className="lg:col-start-1">
                <ShadchanProfileFields
                  control={form.control}
                  isSubmitting={isSubmitting}
                  showApplicationNote={showApplicationNote}
                />
              </FormFields>
              <aside className="lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
                <ShadchanCardPreview
                  control={form.control}
                  identity={previewIdentity}
                />
              </aside>
              <FormActions className="lg:col-start-1">
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
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
