import { z } from "zod";

/**
 * מה הצדדים רואים בכרטיס של הצד השני בהצעה - הפריטים שהשדכן קובע לכל הצעה
 * בנפרד. פרטי התקשרות של המיועד/ת ושל ההורים אינם כאן: הם אינם נפתחים לצד השני
 * בשום מצב. המסד (public.set_proposal_disclosure) אוכף מי רשאי לשנות ושולח את
 * ההתראות; הקובץ בלי תלות בלקוח או בשרת.
 */

export const DISCLOSURE_ITEMS = [
  {
    key: "shareCv",
    column: "share_cv",
    label: "קובץ קו״ח",
    hint: "הקובץ עצמו עלול לכלול טלפון או כתובת.",
  },
  {
    key: "shareReferences",
    column: "share_references",
    label: "פרטי הממליצים",
    hint: "טלפון ואימייל של הממליצים.",
  },
  {
    key: "shareMedical",
    column: "share_medical_info",
    label: "הצהרה רפואית",
    hint: "בלי פרטי הקשר שבהצהרה.",
  },
  {
    key: "shareGroomPhoto",
    column: "share_groom_photo",
    label: "תמונת הבחור",
    hint: "לצד המיועדת בלבד.",
  },
] as const;

export type DisclosureKey = (typeof DISCLOSURE_ITEMS)[number]["key"];
export type ProposalDisclosureFlags = Record<DisclosureKey, boolean>;

export const disclosureFlagsSchema = z.object({
  shareCv: z.boolean(),
  shareReferences: z.boolean(),
  shareMedical: z.boolean(),
  shareGroomPhoto: z.boolean(),
});

/** הדגלים כפי שהם בשורת shidduchim (קו״ח פתוח גם בדגל הישן) */
export function disclosureFromRow(row: {
  share_cv?: boolean | null;
  share_contact_details?: boolean | null;
  share_references?: boolean | null;
  share_medical_info?: boolean | null;
  share_groom_photo?: boolean | null;
}): ProposalDisclosureFlags {
  return {
    shareCv: Boolean(row.share_cv || row.share_contact_details),
    shareReferences: Boolean(row.share_references),
    shareMedical: Boolean(row.share_medical_info),
    shareGroomPhoto: row.share_groom_photo !== false,
  };
}

/** תשובת set_proposal_disclosure: מי קיבל התראה חדשה (ולכן גם מייל) */
export const disclosureResultSchema = z.object({
  notified: z.array(
    z.object({
      user_id: z.string(),
      side: z.enum(["groom", "bride"]),
      other_student_id: z.string(),
      items: z.array(z.string()),
    }),
  ),
});
