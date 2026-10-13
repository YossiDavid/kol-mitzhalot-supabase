/**
 * סכמת הטופס של הקדשה, משותפת לטופס (לקוח) ולפעולות השרת: אותם כללים ואותן
 * הודעות קבועות בשני הצדדים. טקסט הטופס מוצג באתר כטקסט פשוט בלבד, ולכן
 * אסורים בו קישורים (containsForbiddenLink).
 */
import { z } from "zod";

import {
  DEDICATION_KINDS,
  DEDICATION_TYPE_VALUES,
  DONOR_LINE_MAX_LENGTH,
  HONOREE_MAX_LENGTH,
  NOTE_MAX_LENGTH,
  SORT_ORDER_MAX,
  isSponsorKind,
} from "@/features/dedications/lib/dedication-model";
import { isValidIsoDate } from "@/features/dedications/lib/israel-date";
import { containsForbiddenLink } from "@/features/donations/lib/nedarim";

export const DEDICATION_MESSAGES = {
  kindRequired: "נא לבחור סוג",
  honoreeRequired: "נא למלא את שם המוקדש",
  tooLong: (max: number) => `עד ${max} תווים`,
  noLinks: "אי אפשר לכלול קישורים בטקסט ההקדשה",
  startRequired: "נא לבחור תאריך התחלה",
  endRequired: "בפרנס נדרש תאריך סיום",
  invalidDate: "תאריך לא תקין",
  endBeforeStart: "תאריך הסיום לפני תאריך ההתחלה",
  sortOrderInvalid: "סדר תצוגה: מספר שלם בין 0 ל-" + SORT_ORDER_MAX,
} as const;

/** שדה טקסט רשות: ריק = חסר. בלי קישורים, באורך מוגבל */
function optionalPlainText(maxLength: number) {
  return z
    .string()
    .trim()
    .max(maxLength, DEDICATION_MESSAGES.tooLong(maxLength))
    .refine(
      (value) => !containsForbiddenLink(value),
      DEDICATION_MESSAGES.noLinks,
    );
}

/** תאריך ריק (לא הוזן) או תאריך ISO תקין */
const optionalDate = z
  .string()
  .refine(
    (value) => value === "" || isValidIsoDate(value),
    DEDICATION_MESSAGES.invalidDate,
  );

export const dedicationFormSchema = z
  .object({
    kind: z.enum(DEDICATION_KINDS, DEDICATION_MESSAGES.kindRequired),
    // "" = ללא סוג
    dedication_type: z.union([z.literal(""), z.enum(DEDICATION_TYPE_VALUES)]),
    honoree: optionalPlainText(HONOREE_MAX_LENGTH).min(
      1,
      DEDICATION_MESSAGES.honoreeRequired,
    ),
    donor_line: optionalPlainText(DONOR_LINE_MAX_LENGTH),
    note: optionalPlainText(NOTE_MAX_LENGTH),
    starts_on: z
      .string()
      .min(1, DEDICATION_MESSAGES.startRequired)
      .refine(isValidIsoDate, DEDICATION_MESSAGES.invalidDate),
    ends_on: optionalDate,
    // שדה מספר בטופס, מחרוזת בהזנה
    sort_order: z
      .string()
      .trim()
      .regex(/^\d{1,6}$/, DEDICATION_MESSAGES.sortOrderInvalid)
      .refine(
        (value) => Number(value) <= SORT_ORDER_MAX,
        DEDICATION_MESSAGES.sortOrderInvalid,
      ),
    is_published: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (isSponsorKind(value.kind) && value.ends_on === "") {
      ctx.addIssue({
        code: "custom",
        path: ["ends_on"],
        message: DEDICATION_MESSAGES.endRequired,
      });
    }
    if (value.ends_on !== "" && value.ends_on < value.starts_on) {
      ctx.addIssue({
        code: "custom",
        path: ["ends_on"],
        message: DEDICATION_MESSAGES.endBeforeStart,
      });
    }
  });

export type DedicationFormValues = z.infer<typeof dedicationFormSchema>;

/** קלט פעולת השמירה בשרת: ערכי הטופס + מזהה כשמעדכנים */
export const saveDedicationInputSchema = z.object({
  id: z.uuid().optional(),
  values: dedicationFormSchema,
});

export const dedicationIdSchema = z.uuid();

/** ערכי הטופס כשורת מסד (שדות ריקים הופכים ל-NULL, סדר למספר) */
export function toDedicationRow(values: DedicationFormValues) {
  return {
    kind: values.kind,
    dedication_type:
      values.dedication_type === "" ? null : values.dedication_type,
    honoree: values.honoree,
    donor_line: values.donor_line === "" ? null : values.donor_line,
    note: values.note === "" ? null : values.note,
    starts_on: values.starts_on,
    ends_on: values.ends_on === "" ? null : values.ends_on,
    sort_order: Number(values.sort_order),
    is_published: values.is_published,
  };
}
