"use client";

import { useWatch, type Control } from "react-hook-form";

import { FormControl, FormField } from "@/components/ui/form";
import { FormFieldShell } from "@/components/ui/form-field-shell";
import { FormGrid } from "@/components/ui/form-layout";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SearchSelectField } from "@/features/students/components/create-form/fields/search-select-field";
import { COMMUNITY_SEARCH } from "@/features/students/components/create-form/fields-data/shared-options";
import { ShadchanAvatarField } from "@/features/shadchanim/components/shadchan-avatar-field";
import { ShadchanMatchTypesField } from "@/features/shadchanim/components/shadchan-match-types-field";
import { SHADCHAN_GENDER_OPTIONS } from "@/features/shadchanim/lib/gender";
import {
  ageFromBirthDate,
  APPLICATION_NOTE_MAX_LENGTH,
  REFERRAL_SOURCE_MAX_LENGTH,
  BIO_MAX_LENGTH,
  SHADCHAN_MAX_AGE,
  SHADCHAN_MIN_AGE,
  SYNAGOGUE_RABBI_MAX_LENGTH,
  type ShadchanFormData,
} from "@/features/shadchanim/lib/profile-form";

/** תמונת הפרופיל בטופס: בעל התיקייה והתצוגה */
export interface AvatarFieldState {
  ownerId: string;
  previewUrl: string | null;
  onPreviewChange: (url: string | null) => void;
}

interface ShadchanProfileFieldsProps {
  control: Control<ShadchanFormData>;
  isSubmitting: boolean;
  avatar: AvatarFieldState;
  /** "למה כדאי לאשר אותי" (להנהלה בלבד): בהצטרפות ובעריכת מנהל */
  showApplicationNote?: boolean;
}

const BIO_AUDIENCE_NOTICE = "יוצג לכל המשתמשים ברשימת השדכנים";
const BIO_GUIDANCE =
  "כתבו בגוף ראשון על הניסיון והתחומים שלכם, למשפחות שמחפשות שדכן.";
const BIO_ADMIN_POINTER = " דברים שמיועדים להנהלה כתבו בשדה למטה.";

/** "גיל: 45" מתחת לתאריך הלידה, כשהתאריך תקין */
function ageDescription(birthDate: string): string {
  const age = ageFromBirthDate(birthDate);
  const range = `גיל ${SHADCHAN_MIN_AGE}-${SHADCHAN_MAX_AGE}. לא מוצג למשתמשים - גלוי רק לך ולהנהלת האתר.`;
  return age === null ? range : `גיל: ${age}. ${range}`;
}

/** מגדר, תאריך לידה ותמונה - בראש הטופס */
function IdentityFields({
  control,
  isSubmitting,
  avatar,
}: Pick<ShadchanProfileFieldsProps, "control" | "isSubmitting" | "avatar">) {
  const [gender, birthDate] = useWatch({
    control,
    name: ["gender", "birth_date"],
  });
  const isAvatarRequired = gender === "male";

  return (
    <>
      <FormGrid>
        <FormField
          control={control}
          name="gender"
          render={({ field }) => (
            <FormFieldShell label="שדכן / שדכנית" required isComposite>
              <FormControl>
                <div
                  role="radiogroup"
                  aria-label="שדכן / שדכנית"
                  className="flex min-h-10 flex-wrap items-center gap-6"
                >
                  {SHADCHAN_GENDER_OPTIONS.map(({ value, label }) => (
                    <label
                      key={value}
                      className="flex cursor-pointer items-center gap-2"
                    >
                      <input
                        type="radio"
                        name={field.name}
                        value={value}
                        checked={field.value === value}
                        onChange={() => field.onChange(value)}
                        onBlur={field.onBlur}
                        disabled={isSubmitting}
                        className="size-4 accent-primary"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </FormControl>
            </FormFieldShell>
          )}
        />
        <FormField
          control={control}
          name="birth_date"
          render={({ field }) => (
            <FormFieldShell
              label="תאריך לידה"
              required
              description={ageDescription(birthDate ?? "")}
            >
              <Input
                {...field}
                type="date"
                dir="ltr"
                className="text-start"
                disabled={isSubmitting}
              />
            </FormFieldShell>
          )}
        />
      </FormGrid>

      <FormField
        control={control}
        name="avatar_path"
        render={({ field }) => (
          <FormFieldShell
            label="תמונה"
            required={isAvatarRequired}
            description={
              isAvatarRequired
                ? "חובה לשדכנים. מוצגת בכרטיס ובפרופיל שלך למשתמשים המחוברים. JPG, PNG או WEBP, עד 5MB."
                : "רשות. מוצגת בכרטיס ובפרופיל שלך למשתמשים המחוברים. JPG, PNG או WEBP, עד 5MB."
            }
            isComposite
          >
            <ShadchanAvatarField
              ownerId={avatar.ownerId}
              value={field.value}
              onChange={field.onChange}
              previewUrl={avatar.previewUrl}
              onPreviewChange={avatar.onPreviewChange}
              disabled={isSubmitting}
            />
          </FormFieldShell>
        )}
      />
    </>
  );
}

/**
 * שדות פרופיל השדכן, משותפים לטופס ההצטרפות, לעריכה עצמית ולעריכת מנהל.
 * חייבים לשבת בתוך <Form> (react-hook-form).
 */
export function ShadchanProfileFields({
  control,
  isSubmitting,
  avatar,
  showApplicationNote = false,
}: ShadchanProfileFieldsProps) {
  return (
    <>
      <IdentityFields
        control={control}
        isSubmitting={isSubmitting}
        avatar={avatar}
      />

      <div
        className="grid gap-1 rounded-lg border border-border bg-muted/40 p-3"
        data-testid="bio-guidance"
      >
        <p className="font-semibold">{BIO_AUDIENCE_NOTICE}</p>
        <p className="text-body-sm text-muted-foreground">
          {BIO_GUIDANCE}
          {showApplicationNote ? BIO_ADMIN_POINTER : ""}
        </p>
      </div>

      <FormField
        control={control}
        name="bio"
        render={({ field }) => (
          <FormFieldShell label="ביוגרפיה" required>
            <Textarea
              {...field}
              placeholder="לדוגמה: אני שדכנית כבר 8 שנים, מתמחה בשידוכים לבחורי ישיבות ומשפחות מהקהילה החרדית בירושלים"
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
        name="location"
        render={({ field }) => (
          <FormFieldShell
            label="עיר מגורים"
            description="מוצגת בכרטיס שלך ברשימת השדכנים"
            required
          >
            <Input
              {...field}
              placeholder="לדוגמה: בני ברק"
              disabled={isSubmitting}
            />
          </FormFieldShell>
        )}
      />

      <ShadchanMatchTypesField control={control} isSubmitting={isSubmitting} />

      <FormField
        control={control}
        name="specializations"
        render={({ field }) => (
          <FormFieldShell
            label="התמחויות"
            description="מופרדות בפסיקים. עד שלוש הראשונות מוצגות בכרטיס."
          >
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
            <FormFieldShell
              label="טלפון ליצירת קשר"
              description="לא מוצג למשתמשים. גלוי רק לך ולהנהלת האתר."
              required
            >
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
            <FormFieldShell
              label="אימייל ליצירת קשר"
              description="לא מוצג למשתמשים. גלוי רק לך ולהנהלת האתר."
            >
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

      <FormGrid>
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
          name="rabbi_phone"
          render={({ field }) => (
            <FormFieldShell
              label="טלפון של הרב"
              description="לא מוצג למשתמשים. גלוי רק לך ולהנהלת האתר."
              required
            >
              <Input
                {...field}
                type="tel"
                placeholder="+972 50…"
                dir="ltr"
                className="text-start"
                disabled={isSubmitting}
              />
            </FormFieldShell>
          )}
        />
      </FormGrid>

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

      {showApplicationNote && (
        <FormField
          control={control}
          name="referral_source"
          render={({ field }) => (
            <FormFieldShell
              label="מי הפנה אותך לקול מצהלות?"
              description="שם האדם, הארגון או המקום שבו שמעת עלינו. להנהלה בלבד."
            >
              <Input
                {...field}
                value={field.value ?? ""}
                maxLength={REFERRAL_SOURCE_MAX_LENGTH}
                disabled={isSubmitting}
              />
            </FormFieldShell>
          )}
        />
      )}

      {showApplicationNote && (
        <FormField
          control={control}
          name="application_note"
          render={({ field }) => (
            <FormFieldShell
              label="למה כדאי לאשר אותי? (להנהלה בלבד)"
              description="לא יוצג למשתמשים. גלוי רק לך ולהנהלת האתר. אפשר לספר כאן על ההיכרות עם המערכת, על מי שהמליץ עליך, או על כל דבר שיעזור לנו לאשר אותך."
            >
              <Textarea
                {...field}
                value={field.value ?? ""}
                rows={3}
                maxLength={APPLICATION_NOTE_MAX_LENGTH}
                disabled={isSubmitting}
              />
            </FormFieldShell>
          )}
        />
      )}
    </>
  );
}
