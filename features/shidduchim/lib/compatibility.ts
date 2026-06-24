import calculateAge from "@/lib/calculateAge";

/** שורת partner_preferences (מוטמעת ב-students). */
type PartnerPrefsRow = {
  age_min?: number | null;
  age_max?: number | null;
  preferred_countries?: string[] | null;
  work_status?: string | null;
  head_cover_type?: string | null;
  plan_for_life?: string | null;
  cellphone_type?: string | null;
};

function partnerPrefs(student: Record<string, unknown>): PartnerPrefsRow | null {
  const p = student.partner_preferences as
    | PartnerPrefsRow
    | PartnerPrefsRow[]
    | null
    | undefined;
  if (!p) return null;
  return Array.isArray(p) ? p[0] ?? null : p;
}

function firstToken(name: string): string {
  return (name || "").trim().split(/\s+/)[0] || "";
}

function normalizeToken(name: string): string {
  return firstToken(name).toLowerCase();
}

function normalizeCountryLabel(s: string): string {
  return s.trim().toLowerCase();
}

/** תווית תעסוקה/לימודים לפי רשומת employment (כמו בלוח השידוכים). */
export function employmentPrimaryLabel(student: {
  gender?: string;
  employment_history?: { category?: string }[];
}): string {
  const row = student.employment_history?.[0];
  if (!row?.category) return "";
  const g = student.gender;
  switch (row.category) {
    case "yeshiva":
      return "בחור ישיבה";
    case "seminar":
      return "לומדת בסמינר";
    case "at_home":
      return "בבית";
    case "havruta":
      return "לומד עם חברותא";
    case "kolel":
      return "כולל";
    case "profession":
      return g === "male" ? "לומד מקצוע" : "לומדת מקצוע";
    case "working":
      return g === "male" ? "עובד" : "עובדת";
    default:
      return "";
  }
}

/** שם המיועד/ת זהה לשם אחד ההורים שלו/ה (טעות נפוצה בטפסים). */
function candidateNameMatchesOwnParent(student: {
  first_name?: string;
  parents_info?: {
    father?: { self?: { name?: string } };
    mother?: { self?: { name?: string } };
  };
}): boolean {
  const self = normalizeToken(student.first_name || "");
  if (!self) return false;
  const f = normalizeToken(student.parents_info?.father?.self?.name || "");
  const m = normalizeToken(student.parents_info?.mother?.self?.name || "");
  return (f.length > 0 && self === f) || (m.length > 0 && self === m);
}

function ageWithinPartnerRange(
  age: number,
  prefs: PartnerPrefsRow | null,
): boolean | null {
  if (!prefs) return null;
  const min = prefs.age_min;
  const max = prefs.age_max;
  if (min == null && max == null) return null;
  if (min != null && age < min) return false;
  if (max != null && age > max) return false;
  return true;
}

function countryAllowedByPrefs(
  prefs: PartnerPrefsRow | null,
  otherCountry: string | null | undefined,
): boolean | null {
  const list = prefs?.preferred_countries;
  if (!list?.length) return null;
  if (!otherCountry?.trim()) return null;
  const o = normalizeCountryLabel(otherCountry);
  return list.some((c) => normalizeCountryLabel(c) === o);
}

const AGE_GAP_NOTE_THRESHOLD = 6;
/** פער גובה (ס״מ) בין שני המועמדים — בלי שדה «גובה רצוי» ב-partner_preferences. */
const HEIGHT_GAP_CM_THRESHOLD = 25;

export type CompatibilityOptions = {
  /** יש רשומת שידוך שאינה טיוטה לאותה צמדות */
  hasNonDraftPair: boolean;
};

/**
 * הערות אבחון התאמה (בסיס ראשוני — ניתן להרחבה).
 */
export function getCompatibilityNotes(
  groom: Record<string, unknown> | null | undefined,
  bride: Record<string, unknown> | null | undefined,
  opts: CompatibilityOptions,
): string[] {
  const notes: string[] = [];

  if (opts.hasNonDraftPair) {
    notes.push("ההצעה כבר הוצעה בעבר");
  }

  if (!groom || !bride) return notes;

  if (candidateNameMatchesOwnParent(groom) || candidateNameMatchesOwnParent(bride)) {
    notes.push("שם המיועד/ת זהה לשם הורה");
  }

  const gb = (groom as { birth_date?: string }).birth_date;
  const bb = (bride as { birth_date?: string }).birth_date;
  let groomAge: number | null = null;
  let brideAge: number | null = null;
  if (gb && bb) {
    groomAge = Number(calculateAge(gb));
    brideAge = Number(calculateAge(bb));
    if (
      !Number.isNaN(groomAge) &&
      !Number.isNaN(brideAge) &&
      Math.abs(groomAge - brideAge) > AGE_GAP_NOTE_THRESHOLD
    ) {
      notes.push("פער גבוה בגיל המיועדים");
    }
  }

  const groomP = partnerPrefs(groom);
  const brideP = partnerPrefs(bride);

  if (groomAge != null && !Number.isNaN(groomAge)) {
    const ok = ageWithinPartnerRange(groomAge, brideP);
    if (ok === false) {
      notes.push(
        "גיל המיועד מחוץ לטווח הגיל שהוגדר בהעדפות צד המיועדת",
      );
    }
  }
  if (brideAge != null && !Number.isNaN(brideAge)) {
    const ok = ageWithinPartnerRange(brideAge, groomP);
    if (ok === false) {
      notes.push(
        "גיל המיועדת מחוץ לטווח הגיל שהוגדר בהעדפות צד המיועד",
      );
    }
  }

  const groomCountry = (groom as { country?: string }).country;
  const brideCountry = (bride as { country?: string }).country;

  const brideOkCountry = countryAllowedByPrefs(groomP, brideCountry);
  if (brideOkCountry === false) {
    notes.push("ארץ המיועדת אינה ברשימת הארצות המועדפות אצל המיועד");
  }
  const groomOkCountry = countryAllowedByPrefs(brideP, groomCountry);
  if (groomOkCountry === false) {
    notes.push("ארץ המיועד אינה ברשימת הארצות המועדפות אצל המיועדת");
  }

  const gPlan = (groom as { plan_for_life?: string }).plan_for_life;
  const bPlan = (bride as { plan_for_life?: string }).plan_for_life;
  if (
    groomP?.plan_for_life &&
    bPlan &&
    groomP.plan_for_life !== bPlan
  ) {
    notes.push("כיוון חיים של המיועדת אינו תואם להעדפת צד המיועד");
  }
  if (
    brideP?.plan_for_life &&
    gPlan &&
    brideP.plan_for_life !== gPlan
  ) {
    notes.push("כיוון חיים של המיועד אינו תואם להעדפת צד המיועדת");
  }

  const bCover = (bride as { head_cover_type?: string }).head_cover_type;
  if (groomP?.head_cover_type && bCover && groomP.head_cover_type !== bCover) {
    notes.push("כיסוי ראש של המיועדת אינו תואם להעדפת צד המיועד");
  }

  const gCell = (groom as { cellphone_type?: string }).cellphone_type;
  const bCell = (bride as { cellphone_type?: string }).cellphone_type;
  if (groomP?.cellphone_type && bCell && groomP.cellphone_type !== bCell) {
    notes.push("סוג טלפון של המיועדת אינו תואם להעדפת צד המיועד");
  }
  if (brideP?.cellphone_type && gCell && brideP.cellphone_type !== gCell) {
    notes.push("סוג טלפון של המיועד אינו תואם להעדפת צד המיועדת");
  }

  const gs = (groom as { personal_status?: string }).personal_status;
  const bs = (bride as { personal_status?: string }).personal_status;
  if (gs && bs && gs !== bs) {
    notes.push("סטטוס המיועדים אינו זהה");
  }

  const gh = Number((groom as { height?: string | number }).height);
  const bh = Number((bride as { height?: string | number }).height);
  if (
    !Number.isNaN(gh) &&
    !Number.isNaN(bh) &&
    gh > 0 &&
    bh > 0 &&
    Math.abs(gh - bh) > HEIGHT_GAP_CM_THRESHOLD
  ) {
    notes.push("פער גבוה בגובה בין המיועדים");
  }

  const groomReq = (groomP?.work_status || "").trim();
  const brideLab = employmentPrimaryLabel(
    bride as { gender?: string; employment_history?: { category?: string }[] },
  );
  if (groomReq.length > 2 && brideLab) {
    const hit =
      groomReq.includes(brideLab) ||
      brideLab.split(/\s+/).some((w) => w.length > 2 && groomReq.includes(w));
    if (!hit) {
      notes.push(
        "תעסוקת המיועדת אינה תואמת לדרישת ההורים (לפי העדפות צד המיועד)",
      );
    }
  }

  const brideReq = (brideP?.work_status || "").trim();
  const groomLab = employmentPrimaryLabel(
    groom as { gender?: string; employment_history?: { category?: string }[] },
  );
  if (brideReq.length > 2 && groomLab) {
    const hit =
      brideReq.includes(groomLab) ||
      groomLab.split(/\s+/).some((w) => w.length > 2 && brideReq.includes(w));
    if (!hit) {
      notes.push(
        "תעסוקת המיועד אינה תואמת לדרישת ההורים (לפי העדפות צד המיועדת)",
      );
    }
  }

  return notes;
}
