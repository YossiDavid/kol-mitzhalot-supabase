"use client";

import { z } from "zod";

import { isValidPhone, PHONE_INVALID_MESSAGE } from "@/lib/phone";
import {
  FILL_REASON_MAX_LENGTH,
  FILL_REASON_MIN_LENGTH,
  isThirdPartyCardFor,
} from "@/features/students/lib/third-party-card";
import type { StudentPhotoItem } from "@/features/students/lib/student-photo-rules";
import { studentFields } from "./fields-data";
import { collectRequiredIssues } from "./required-fields";

// שדות חובה לא נכתבים כאן: הם נגזרים מ-`required: true` במערך השדות
// (fields-data/, required-fields.ts), כדי שהכוכבית והאכיפה יבואו ממקור אחד.
// כאן נשארים רק מבנה הערכים ובדיקות תוכן (למשל גובה מינימלי).
const opt = z.string().default("");

const nameParts = z.object({
  prefix: opt,
  name: opt,
  suffix: opt,
});

const MIN_HEIGHT_CM = 50;

const NUMERIC_SEGMENT_PATTERN = /^\d+$/;

const studentFormBaseSchema = z.object({
  isOnShiduchim: z.boolean().default(true),
  // עבור מי הכרטיס מולא: self / child / other. ריק בכרטיס ישן
  cardFor: opt,
  gender: opt,

  firstName: opt,
  lastName: opt,
  nickname: opt,
  birthDate: opt,
  // תמונות שמורות מגיעות כפריטים ברשימה, ולכן בעריכה הן נחשבות מולאו.
  // המגבלות על כל קובץ נבדקות בהוספה לגלריה.
  photos: z.array(z.custom<StudentPhotoItem>()).default([]),

  country: opt,
  city: opt,
  street: opt,
  house: opt,
  community: opt,
  shtible: opt,
  institutionId: opt,
  personalStatus: opt,
  // גובה בס״מ. ריק מותר, אבל ערך שהוזן חייב להיות סביר —
  // מתחת ל-50 זה כמעט תמיד טעות הקלדה.
  height: opt.refine((v) => v === "" || Number(v) >= MIN_HEIGHT_CM, {
    message: `גובה מינימלי הוא ${MIN_HEIGHT_CM} ס״מ`,
  }),
  cellphoneType: opt,
  phone: opt,
  planForLife: opt,
  headCoverType: opt,
  about: opt,
  cv: z
    .object({
      file: z.any().nullable(),
      // בעריכה: הקו״ח שכבר שמור. נחשב "מולא", כדי שלא יידרש להעלות מחדש
      existingUrl: z.string().nullable().optional(),
    })
    .default({ file: null }),

  father: z.object({
    self: nameParts,
    phone: opt,
    job: opt,
    email: opt,
    grandFather: nameParts,
    grandMother: nameParts,
  }),

  mother: z.object({
    self: nameParts,
    maidenName: opt,
    phone: opt,
    job: opt,
    email: opt,
    grandFather: nameParts,
    grandMother: nameParts,
  }),

  family: z.object({
    numberOfChildren: opt,
    currentChildPlace: opt,
    about: opt,
    mechutanim: z.array(z.record(z.string(), z.unknown())).default([]),
  }),

  education: z.object({
    yeshivaKtana: z.array(z.record(z.string(), z.unknown())).default([]),
    yeshivaGdola: z.array(z.record(z.string(), z.unknown())).default([]),
    kolel: z.array(z.record(z.string(), z.unknown())).default([]),
    seminar: z.array(z.record(z.string(), z.unknown())).default([]),
  }),

  employment: z.object({
    tags: z.array(z.string()).default([]),
    yeshiva: opt,
    kolel: opt,
    seminar: opt,
    havruta: z.object({ with: opt, where: opt }),
    working: z.object({ role: opt, where: opt }),
    profession: z.object({ what: opt, where: opt }),
  }),

  previousPartners: z.array(z.record(z.string(), z.unknown())).default([]),
  knownRabbanim: z.array(z.record(z.string(), z.unknown())).default([]),
  knownFriends: z.array(z.record(z.string(), z.unknown())).default([]),
  knownFamilyFriends: z.array(z.record(z.string(), z.unknown())).default([]),

  parents: z.object({
    status: opt,
    holding: opt,
    deadParent: opt,
    fatherDeathDate: opt,
    motherDeathDate: opt,
    isMotherRemarried: opt,
    newHusbandName: opt,
    isFatherRemarried: opt,
    newWifeName: opt,
  }),

  medical: z.object({
    status: opt,
    exposureLevel: opt,
    details: opt,
    documents: z.array(z.any()).default([]),
    contactForMoreInfo: opt,
    otherContact: z.array(z.record(z.string(), z.unknown())).default([]),
    relatedIssuePreference: opt,
  }),

  partner: z.object({
    ageRange: z.object({
      min: z.number().default(18),
      max: z.number().default(40),
    }),
    preferredCountry: opt,
    specificCountries: z.array(z.record(z.string(), z.unknown())).default([]),
    workStatus: z.array(z.string()).default([]),
    headCoverType: opt,
    planForLife: opt,
    cellphoneType: opt,
    aboutThePartner: opt,
    additionalInformation: opt,
  }),

  author: z.object({
    name: opt,
    phone: opt,
    // טקסט חופשי: רק כשהקשר הוא "אחר" (author-info.ts)
    relation: opt,
    relationType: opt,
    // "true" / "false" / "" (לא נענה)
    knowsWell: opt,
    // מדוע צד שלישי מילא את הכרטיס (author-info.ts)
    fillReason: opt,
  }),
});

function toIssuePath(path: string): Array<string | number> {
  return path
    .split(".")
    .map((segment) =>
      NUMERIC_SEGMENT_PATTERN.test(segment) ? Number(segment) : segment,
    );
}

/** תוכן שדות ממלא הכרטיס (שדה חובה ריק נתפס ב-collectRequiredIssues) */
function collectAuthorContentIssues(
  values: z.infer<typeof studentFormBaseSchema>,
): Array<{ path: string; message: string }> {
  const hasAuthor =
    values.cardFor === "child" || isThirdPartyCardFor(values.cardFor);
  if (!hasAuthor) return [];

  const issues: Array<{ path: string; message: string }> = [];
  const phone = values.author.phone.trim();
  if (phone && !isValidPhone(phone)) {
    issues.push({ path: "author.phone", message: PHONE_INVALID_MESSAGE });
  }
  const reason = values.author.fillReason.trim();
  if (
    isThirdPartyCardFor(values.cardFor) &&
    reason &&
    (reason.length < FILL_REASON_MIN_LENGTH ||
      reason.length > FILL_REASON_MAX_LENGTH)
  ) {
    issues.push({
      path: "author.fillReason",
      message: `ההסבר צריך להיות באורך ${FILL_REASON_MIN_LENGTH}–${FILL_REASON_MAX_LENGTH} תווים`,
    });
  }
  return issues;
}

export const studentFormSchema = studentFormBaseSchema.superRefine(
  (values, ctx) => {
    const issues = [
      ...collectRequiredIssues(studentFields, values),
      ...collectAuthorContentIssues(values),
    ];
    for (const issue of issues) {
      ctx.addIssue({
        code: "custom",
        path: toIssuePath(issue.path),
        message: issue.message,
      });
    }
  },
);

export type StudentFormValues = z.infer<typeof studentFormSchema>;
