import type { StudentFormValues } from "@/features/students/components/create-form/schema";

// בניית ה-payload ל-create_full_student_profile ול-update_full_student_profile.
// שתי הפונקציות ב-DB מקבלות בדיוק את אותה מבנה, ולכן הלוגיקה חיה כאן ולא
// בתוך דף היצירה — כדי שמסך העריכה לא ישכפל אותה ויסטה ממנה עם הזמן.

type RepeaterItem = Record<string, unknown>;

/** ערכי ה-enum במסד הנתונים */
const CELLPHONE_TYPES = new Set([
  "kosher",
  "sms",
  "protected_smartphone",
  "other",
]);

export type StudentPayload = Record<string, unknown>;

export type BuildStudentPayloadOptions = {
  /** נכלל רק ביצירה. עריכה אינה מעבירה בעלות ולכן שולחת undefined. */
  userId?: string;
  /**
   * כתובות הקבצים. ביצירה הן נשלחות null כי הקבצים מועלים רק אחרי שנוצר
   * ה-student_id; בעריכה ה-id כבר קיים ולכן נשלחות הכתובות הסופיות.
   */
  imageUrl?: string | null;
  cvUrl?: string | null;
  medicalDocuments?: string[];
};

/** ממיר תאריך לפורמט ISO (YYYY-MM-DD) */
export function formatDateToISO(
  dateString: string | null | undefined,
): string | null {
  if (!dateString || dateString.trim() === "") {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString;
  }

  const ddmmyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(dateString);
  if (ddmmyyyy) {
    const day = ddmmyyyy[1].padStart(2, "0");
    const month = ddmmyyyy[2].padStart(2, "0");
    const year = ddmmyyyy[3];
    return `${year}-${month}-${day}`;
  }

  const ddmmyyyy2 = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(dateString);
  if (ddmmyyyy2) {
    const day = ddmmyyyy2[1].padStart(2, "0");
    const month = ddmmyyyy2[2].padStart(2, "0");
    const year = ddmmyyyy2[3];
    return `${year}-${month}-${day}`;
  }

  try {
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  } catch {
    return null;
  }

  return null;
}

// תווי כיווניות (RTL/LTR marks) נדבקים לערכים שמגיעים מהדפדפן ומפילים את
// ההמרה ל-enum ב-Postgres, ולכן מנוקים כאן.
function normalizeEnumInput(rawValue: unknown): string {
  if (rawValue === null || rawValue === undefined) return "";
  return String(rawValue)
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "")
    .trim()
    .toLowerCase();
}

// שמות היסטוריים בטופס לא תואמים ל-personal_status_enum.
export function mapPersonalStatus(status: string): string {
  const normalized = normalizeEnumInput(status);
  if (normalized === "divorce") return "divorced";
  if (normalized === "widower") return "widowed";
  return normalized;
}

export function mapCellphoneType(value: unknown): string | null {
  const normalized = normalizeEnumInput(value);
  if (!normalized) return null;
  return CELLPHONE_TYPES.has(normalized) ? normalized : null;
}

function toText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? value : String(value);
}

function toNested(item: RepeaterItem, key: string): RepeaterItem {
  const value = item[key];
  return value && typeof value === "object" ? (value as RepeaterItem) : {};
}

function buildEducationHistory(values: StudentFormValues) {
  const byInstitutionType = [
    ["yeshiva_ktana", values.education?.yeshivaKtana],
    ["yeshiva_gdola", values.education?.yeshivaGdola],
    ["kolel", values.education?.kolel],
    ["seminar", values.education?.seminar],
  ] as const;

  return byInstitutionType.flatMap(([institutionType, entries]) =>
    (entries ?? []).map((entry) => ({
      institution_type: institutionType,
      name: toText(entry.name),
      community: toText(entry.community) || null,
      city: toText(entry.city) || null,
    })),
  );
}

// כל קטגוריית תעסוקה נשמרת רק אם היא גם נבחרה ב-tags וגם מולאה, אחרת
// נשמרות שורות ריקות לקטגוריות שהמשתמש בכלל לא סימן.
function buildEmploymentHistory(values: StudentFormValues) {
  const employment = values.employment;
  const tags = employment?.tags ?? [];
  const rows: Array<{
    category: string;
    role: string | null;
    location: string | null;
    description: string | null;
  }> = [];

  const pushIfSelected = (
    category: string,
    isFilled: boolean,
    role: string | null,
    location: string | null,
  ) => {
    if (!tags.includes(category) || !isFilled) return;
    rows.push({ category, role, location, description: null });
  };

  pushIfSelected(
    "yeshiva",
    Boolean(employment?.yeshiva),
    null,
    employment?.yeshiva ?? null,
  );
  pushIfSelected(
    "kolel",
    Boolean(employment?.kolel),
    null,
    employment?.kolel ?? null,
  );
  pushIfSelected(
    "seminar",
    Boolean(employment?.seminar),
    null,
    employment?.seminar ?? null,
  );
  pushIfSelected(
    "havruta",
    Boolean(employment?.havruta?.with),
    employment?.havruta?.with ?? null,
    employment?.havruta?.where || null,
  );
  pushIfSelected(
    "working",
    Boolean(employment?.working?.role),
    employment?.working?.role ?? null,
    employment?.working?.where || null,
  );
  pushIfSelected(
    "profession",
    Boolean(employment?.profession?.what),
    employment?.profession?.what ?? null,
    employment?.profession?.where || null,
  );

  return rows;
}

function buildMedicalRecords(
  values: StudentFormValues,
  documents: string[],
): StudentPayload | null {
  const medical = values.medical;
  // "תקין" (וגם היעדר תשובה) לא מייצר רשומה רפואית כלל.
  if (!medical?.status || medical.status === "good") return null;

  const contacts = medical.otherContact ?? [];
  const contactInfo =
    medical.contactForMoreInfo === "parents"
      ? { type: "parents" }
      : medical.contactForMoreInfo === "other_contact"
        ? {
            type: "other",
            contacts: contacts.map((contact) => ({
              name: toText(contact.name),
              phone: toText(contact.phone),
              email: toText(contact.email) || null,
            })),
          }
        : null;

  return {
    status: medical.status,
    exposure_level: medical.exposureLevel || null,
    details: medical.details || null,
    documents,
    contact_info: contactInfo,
    related_issue_preference: medical.relatedIssuePreference || null,
  };
}

function buildReferences(values: StudentFormValues) {
  const byReferenceType = [
    ["rabbi", values.knownRabbanim],
    ["friend", values.knownFriends],
    ["family_friend", values.knownFamilyFriends],
  ] as const;

  return byReferenceType.flatMap(([referenceType, entries]) =>
    (entries ?? []).map((entry) => ({
      reference_type: referenceType,
      name: toText(entry.name),
      phone: toText(entry.phone),
      // ממליץ מסוג "רב" לא שומר אימייל בטופס.
      email: referenceType === "rabbi" ? null : toText(entry.email) || null,
    })),
  );
}

function buildPreviousPartners(values: StudentFormValues) {
  return (values.previousPartners ?? []).map((partner) => {
    const divorce = toNested(partner, "divorce");
    return {
      separation_type: toText(partner.separationType) || null,
      full_name: toText(partner.fullName) || null,
      marriage_date: formatDateToISO(toText(partner.marriageDate)),
      divorce_date: formatDateToISO(toText(divorce.date)),
      death_date: formatDateToISO(toText(partner.deathDate)),
      children_number: partner.childrenNumber
        ? parseInt(toText(partner.childrenNumber))
        : null,
      divorce_details:
        partner.separationType === "divorce"
          ? {
              reason: toText(divorce.reason) || null,
              rabbiName: toText(divorce.rabbiName) || null,
              rabbiPhone: toText(divorce.rabbiPhone) || null,
            }
          : null,
    };
  });
}

function buildPartnerPreferences(values: StudentFormValues) {
  const partner = values.partner;
  return {
    age_min: partner?.ageRange?.min || null,
    age_max: partner?.ageRange?.max || null,
    preferred_countries:
      partner?.preferredCountry === "all"
        ? []
        : (partner?.specificCountries
            ?.map((country) => toText(country.name) || toText(country.locale))
            .filter(Boolean) ?? []),
    work_status: partner?.workStatus?.length ? partner.workStatus : [],
    head_cover_type: partner?.headCoverType || null,
    plan_for_life: partner?.planForLife || null,
    cellphone_type: mapCellphoneType(partner?.cellphoneType),
    about_partner: partner?.aboutThePartner || null,
    additional_information: partner?.additionalInformation || null,
  };
}

function buildParentsInfo(values: StudentFormValues) {
  const { father, mother, parents } = values;
  return {
    father: {
      self: {
        prefix: father?.self?.prefix || "",
        name: father?.self?.name || "",
        suffix: father?.self?.suffix || "",
      },
      phone: father?.phone || "",
      job: father?.job || "",
      email: father?.email || "",
      grandFather: {
        prefix: father?.grandFather?.prefix || "",
        name: father?.grandFather?.name || "",
        suffix: father?.grandFather?.suffix || "",
      },
      grandMother: {
        prefix: father?.grandMother?.prefix || "",
        name: father?.grandMother?.name || "",
        suffix: father?.grandMother?.suffix || "",
      },
    },
    mother: {
      self: {
        prefix: mother?.self?.prefix || "",
        name: mother?.self?.name || "",
        suffix: mother?.self?.suffix || "",
      },
      maidenName: mother?.maidenName || "",
      phone: mother?.phone || "",
      job: mother?.job || "",
      email: mother?.email || "",
      grandFather: {
        prefix: mother?.grandFather?.prefix || "",
        name: mother?.grandFather?.name || "",
        suffix: mother?.grandFather?.suffix || "",
      },
      grandMother: {
        prefix: mother?.grandMother?.prefix || "",
        name: mother?.grandMother?.name || "",
        suffix: mother?.grandMother?.suffix || "",
      },
    },
    status: parents?.status || null,
    holding: parents?.holding || null,
    deadParent: parents?.deadParent || null,
    fatherDeathDate: formatDateToISO(parents?.fatherDeathDate),
    motherDeathDate: formatDateToISO(parents?.motherDeathDate),
    isMotherRemarried: parents?.isMotherRemarried || null,
    newHusbandName: parents?.newHusbandName || null,
    isFatherRemarried: parents?.isFatherRemarried || null,
    newWifeName: parents?.newWifeName || null,
  };
}

function buildFamilyInfo(values: StudentFormValues) {
  const family = values.family;
  return {
    numberOfChildren: family?.numberOfChildren
      ? parseInt(family.numberOfChildren)
      : null,
    currentChildPlace: family?.currentChildPlace
      ? parseInt(family.currentChildPlace)
      : null,
    about: family?.about || null,
    mechutanim: (family?.mechutanim ?? []).map((mechutan) => ({
      id: toText(mechutan.id) || null,
      firstName: toText(mechutan.firstName) || null,
      lastName: toText(mechutan.lastName) || null,
      city: toText(mechutan.city) || null,
    })),
  };
}

// שדות NOT NULL במסד הנתונים. הוולידציה של הטופס אמורה לתפוס אותם קודם,
// אבל שגיאת DB גולמית אינה קריאה למשתמש ולכן נבדקים גם כאן.
const REQUIRED_FIELD_LABELS: Array<[keyof StudentFormValues, string]> = [
  ["firstName", "שם פרטי"],
  ["lastName", "שם משפחה"],
  ["birthDate", "תאריך לידה"],
  ["gender", "מין"],
  ["personalStatus", "סטטוס אישי"],
  ["country", "ארץ"],
  ["city", "עיר"],
];

/** שמות השדות החסרים בעברית, להצגה למשתמש. רשימה ריקה = תקין. */
export function missingRequiredStudentFields(
  values: StudentFormValues,
): string[] {
  return REQUIRED_FIELD_LABELS.filter(([field]) => !values[field]).map(
    ([, label]) => label,
  );
}

export function buildStudentPayload(
  values: StudentFormValues,
  options: BuildStudentPayloadOptions = {},
): StudentPayload {
  const {
    userId,
    imageUrl = null,
    cvUrl = null,
    medicalDocuments = [],
  } = options;

  return {
    ...(userId ? { user_id: userId } : {}),
    in_shidduchim: values.isOnShiduchim ?? true,
    first_name: values.firstName,
    last_name: values.lastName,
    identity_number: values.identityNumber,
    birth_date: formatDateToISO(values.birthDate),
    gender: values.gender,
    personal_status: mapPersonalStatus(values.personalStatus),
    height: values.height ? parseFloat(values.height) : null,
    phone: values.phone,
    country: values.country,
    city: values.city,
    street: values.street,
    house: values.house,
    community: values.community || null,
    shtible: values.shtible || null,
    institution_id: values.institutionId || null,
    cellphone_type: mapCellphoneType(values.cellphoneType),
    plan_for_life: values.planForLife || null,
    head_cover_type: values.headCoverType || null,
    image_url: imageUrl,
    cv_url: cvUrl,
    about: values.about || null,
    parents_info: buildParentsInfo(values),
    family_info: buildFamilyInfo(values),
    author_info: {
      name: values.author?.name || "",
      phone: values.author?.phone || "",
      relation: values.author?.relation || "",
    },
    education_history: buildEducationHistory(values),
    employment_history: buildEmploymentHistory(values),
    medical_records: buildMedicalRecords(values, medicalDocuments),
    partner_preferences: buildPartnerPreferences(values),
    references: buildReferences(values),
    previous_partners: buildPreviousPartners(values),
  };
}
