"use client";

import type { Control } from "react-hook-form";

import { FormField } from "@/components/ui/form";
import { FormFieldShell } from "@/components/ui/form-field-shell";
import { FormGrid } from "@/components/ui/form-layout";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SearchSelectField } from "@/features/students/components/create-form/fields/search-select-field";
import { COMMUNITY_SEARCH } from "@/features/students/components/create-form/fields-data/shared-options";
import {
  BIO_MAX_LENGTH,
  SYNAGOGUE_RABBI_MAX_LENGTH,
  type ShadchanFormData,
} from "@/features/shadchanim/lib/profile-form";

interface ShadchanProfileFieldsProps {
  control: Control<ShadchanFormData>;
  isSubmitting: boolean;
}

/**
 * שדות פרופיל השדכן, משותפים לטופס ההצטרפות, לעריכה עצמית ולעריכת מנהל.
 * חייבים לשבת בתוך <Form> (react-hook-form).
 */
export function ShadchanProfileFields({
  control,
  isSubmitting,
}: ShadchanProfileFieldsProps) {
  return (
    <>
      <FormField
        control={control}
        name="bio"
        render={({ field }) => (
          <FormFieldShell label="ביוגרפיה" required>
            <Textarea
              {...field}
              placeholder="ספר על עצמך, הרקע שלך, והניסיון שלך בשדכנות"
              rows={5}
              maxLength={BIO_MAX_LENGTH}
              disabled={isSubmitting}
            />
          </FormFieldShell>
        )}
      />

      <FormGrid>
        <FormField
          control={control}
          name="experience_years"
          render={({ field }) => (
            <FormFieldShell label="שנות ניסיון" required>
              <Input
                {...field}
                type="number"
                min="0"
                placeholder="לדוגמה: 5"
                disabled={isSubmitting}
              />
            </FormFieldShell>
          )}
        />
        <FormField
          control={control}
          name="closed_matches"
          render={({ field }) => (
            <FormFieldShell label="כמה שידוכים סגרתי" required>
              <Input
                {...field}
                type="number"
                min="0"
                placeholder="לדוגמה: 12"
                disabled={isSubmitting}
              />
            </FormFieldShell>
          )}
        />
      </FormGrid>

      <FormField
        control={control}
        name="specializations"
        render={({ field }) => (
          <FormFieldShell label="התמחויות" description="מופרדות בפסיקים">
            <Input
              {...field}
              placeholder="לדוגמה: שידוכים צעירים, שידוכים מבוגרים"
              disabled={isSubmitting}
            />
          </FormFieldShell>
        )}
      />

      <FormGrid>
        <FormField
          control={control}
          name="contact_phone"
          render={({ field }) => (
            <FormFieldShell label="טלפון ליצירת קשר" required>
              <Input
                {...field}
                type="tel"
                placeholder="+972 50…"
                autoComplete="tel"
                dir="ltr"
                className="text-start"
                disabled={isSubmitting}
              />
            </FormFieldShell>
          )}
        />
        <FormField
          control={control}
          name="contact_email"
          render={({ field }) => (
            <FormFieldShell label="אימייל ליצירת קשר">
              <Input
                {...field}
                type="email"
                placeholder="contact@example.com"
                autoComplete="email"
                disabled={isSubmitting}
              />
            </FormFieldShell>
          )}
        />
      </FormGrid>

      <FormField
        control={control}
        name="community"
        render={({ field }) => (
          <FormFieldShell label="קהילה / חסידות" required>
            <SearchSelectField
              {...COMMUNITY_SEARCH}
              id="community"
              value={field.value}
              onChange={field.onChange}
              disabled={isSubmitting}
            />
          </FormFieldShell>
        )}
      />

      <FormField
        control={control}
        name="synagogue_rabbi"
        render={({ field }) => (
          <FormFieldShell
            label="רב בית הכנסת שלך"
            description="שם הרב של בית הכנסת שבו אתה מתפלל. הפרט נראה למנהל המערכת בלבד."
            required
          >
            <Input
              {...field}
              placeholder="לדוגמה: הרב יעקב כהן"
              maxLength={SYNAGOGUE_RABBI_MAX_LENGTH}
              disabled={isSubmitting}
            />
          </FormFieldShell>
        )}
      />

      <FormField
        control={control}
        name="languages"
        render={({ field }) => (
          <FormFieldShell label="שפות" description="מופרדות בפסיקים">
            <Input
              {...field}
              placeholder="לדוגמה: עברית, אנגלית, יידיש"
              disabled={isSubmitting}
            />
          </FormFieldShell>
        )}
      />
    </>
  );
}
