"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Route } from "next";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
import { SHADCHAN_AVATARS_BUCKET } from "@/features/shadchanim/lib/avatar";
import type { PreviewIdentity } from "@/features/shadchanim/lib/preview-card";
import {
  shadchanProfileSchema,
  type ShadchanFormData,
} from "@/features/shadchanim/lib/profile-form";
import { createClient } from "@/lib/supabase/client";

/** תוקף הקישור לתצוגת התמונה השמורה בטופס */
const PREVIEW_SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * התמונה להצגה בטופס: התמונה השמורה (נחתמת בדפדפן - בעל התמונה והמנהל
 * רשאים לקרוא אותה), ובהיעדרה תמונה ישנה מהמטא-דאטה. אחרי העלאה - הקובץ המקומי.
 */
function useAvatarPreview(
  savedPath: string,
  fallbackUrl: string | null,
): [string | null, (url: string | null) => void] {
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    savedPath ? null : fallbackUrl,
  );

  useEffect(() => {
    if (!savedPath) return;
    let isCancelled = false;
    createClient()
      .storage.from(SHADCHAN_AVATARS_BUCKET)
      .createSignedUrl(savedPath, PREVIEW_SIGNED_URL_TTL_SECONDS)
      .then(({ data, error }) => {
        if (error) console.error("Error signing shadchan avatar:", error);
        if (!isCancelled && data?.signedUrl) setPreviewUrl(data.signedUrl);
      });
    return () => {
      isCancelled = true;
    };
  }, [savedPath]);

  return [previewUrl, setPreviewUrl];
}

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
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useAvatarPreview(
    defaultValues.avatar_path,
    previewIdentity.avatarUrl,
  );
  // התצוגה המקדימה של הכרטיס מציגה את התמונה שבטופס, גם לפני השמירה
  const cardIdentity = useMemo(
    () => ({ ...previewIdentity, avatarUrl: avatarPreviewUrl }),
    [previewIdentity, avatarPreviewUrl],
  );

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
                  avatar={{
                    ownerId: previewIdentity.id,
                    previewUrl: avatarPreviewUrl,
                    onPreviewChange: setAvatarPreviewUrl,
                  }}
                  showApplicationNote={showApplicationNote}
                />
              </FormFields>
              <aside className="lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
                <ShadchanCardPreview
                  control={form.control}
                  identity={cardIdentity}
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
