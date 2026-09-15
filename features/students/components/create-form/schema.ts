"use client";

import { z } from "zod";

import type { StudentPhotoItem } from "@/features/students/lib/student-photo-rules";
import { GENERIC_REQUIRED_MESSAGE } from "./field-messages";

// הודעה כללית בכוונה: המרנדר מחליף אותה בנוסח לפי התווית שמוצגת וסוג הפקד
// ("נא למלא שם אביו", "נא לבחור סטטוס אישי") - field-messages.ts.
// הודעה מפורשת נכתבת כאן רק כשהיא טובה מהנוסח הזה.
const req = (msg = GENERIC_REQUIRED_MESSAGE) => z.string().min(1, msg);
const opt = z.string().default("");

const namePartsRequired = z.object({
  prefix: opt,
  name: req(),
  suffix: opt,
});

const namePartsOptional = z.object({
  prefix: opt,
  name: opt,
  suffix: opt,
});

export const studentFormSchema = z.object({
  isOnShiduchim: z.boolean().default(true),
  // התווית היא משפט שלם ("אני ממלא/ת את טופס הקו״ח עבור:"), ולכן הודעה מפורשת
  gender: req("נא לבחור מיועד/מיועדת"),

  firstName: req(),
  lastName: req(),
  identityNumber: req(),
  birthDate: req(),
  // לא חובה בכוונה: גם השדה הקודם (תמונה בודדת) לא נאכף, וכרטיס קיים בלי
  // תמונות חייב להמשיך להישמר. המגבלות על כל קובץ נבדקות בהוספה לגלריה.
  photos: z.array(z.custom<StudentPhotoItem>()).default([]),

  country: req(),
  city: req(),
  street: req(),
  house: req(),
  community: opt,
  shtible: opt,
  institutionId: opt,
  personalStatus: req(),
  // גובה בס״מ. ריק מותר, אבל ערך שהוזן חייב להיות סביר —
  // מתחת ל-50 זה כמעט תמיד טעות הקלדה.
  height: opt.refine((v) => v === "" || Number(v) >= 50, {
    message: "גובה מינימלי הוא 50 ס״מ",
  }),
  cellphoneType: req(),
  phone: opt,
  planForLife: opt,
  headCoverType: opt,
  about: opt,
  cv: z.object({ file: z.any().nullable() }).default({ file: null }),

  father: z.object({
    self: namePartsRequired,
    phone: req(),
    job: req(),
    email: opt,
    grandFather: namePartsRequired,
    grandMother: namePartsRequired,
  }),

  mother: z.object({
    self: namePartsRequired,
    maidenName: req(),
    phone: req(),
    job: req(),
    email: opt,
    grandFather: namePartsRequired,
    grandMother: namePartsRequired,
  }),

  family: z.object({
    numberOfChildren: req(),
    currentChildPlace: req(),
    about: req(),
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
    additionalInformation: req(),
  }),

  author: z.object({
    name: req(),
    phone: req(),
    relation: req(),
  }),
});

export type StudentFormValues = z.infer<typeof studentFormSchema>;
