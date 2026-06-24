"use client"

import { z } from "zod"

const req = (msg = "שדה חובה") => z.string().min(1, msg)
const opt = z.string().default("")

const namePartsRequired = z.object({
  prefix: opt,
  name: req(),
  suffix: opt,
})

const namePartsOptional = z.object({
  prefix: opt,
  name: opt,
  suffix: opt,
})

export const studentFormSchema = z.object({
  isOnShiduchim: z.boolean().default(true),
  gender: req("יש לבחור מיועד/מיועדת"),

  firstName: req("נא למלא שם פרטי"),
  lastName: req("נא למלא שם משפחה"),
  identityNumber: req("נא למלא תעודת זהות"),
  birthDate: req("נא לבחור תאריך לידה"),
  image: z.object({ file: z.any().nullable() }).default({ file: null }),

  country: req("נא למלא ארץ"),
  city: req("נא למלא עיר"),
  street: req("נא למלא רחוב"),
  house: req("נא למלא מספר בית"),
  community: opt,
  shtible: opt,
  personalStatus: req("נא לבחור סטטוס אישי"),
  height: opt,
  cellphoneType: req("נא לבחור סוג טלפון"),
  phone: opt,
  planForLife: opt,
  headCoverType: opt,
  about: opt,
  cv: z.object({ file: z.any().nullable() }).default({ file: null }),

  father: z.object({
    self: namePartsRequired,
    phone: req("נא למלא טלפון"),
    job: req("נא למלא עיסוק"),
    email: opt,
    grandFather: namePartsRequired,
    grandMother: namePartsRequired,
  }),

  mother: z.object({
    self: namePartsRequired,
    maidenName: req("נא למלא שם נעורים"),
    phone: req("נא למלא טלפון"),
    job: req("נא למלא עיסוק"),
    email: opt,
    grandFather: namePartsRequired,
    grandMother: namePartsRequired,
  }),

  family: z.object({
    numberOfChildren: req("נא למלא מספר ילדים"),
    currentChildPlace: req("נא למלא מיקום הילד"),
    about: req("נא לכתוב כמה מילים"),
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
    workStatus: opt,
    headCoverType: opt,
    planForLife: opt,
    cellphoneType: opt,
    aboutThePartner: opt,
    additionalInformation: req("נא למלא מידע לשדכן"),
  }),

  author: z.object({
    name: req("נא למלא שם ממלא הטופס"),
    phone: req("נא למלא טלפון ממלא הטופס"),
  }),
})

export type StudentFormValues = z.infer<typeof studentFormSchema>
