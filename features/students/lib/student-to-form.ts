import type { StudentFormValues } from "@/features/students/components/create-form/schema";

// המיפוי ההפוך ל-build-student-payload: שורת students + טבלאות הבת שלה חזרה
// לערכי הטופס. כל שינוי שם שדה שם חייב להשתקף כאן, אחרת העריכה תאבד מידע.

type Row = Record<string, unknown>;

export type StudentRowWithRelations = Row & {
  education_history?: Row[] | null;
  employment_history?: Row[] | null;
  medical_records?: Row | Row[] | null;
  partner_preferences?: Row | Row[] | null;
  references?: Row[] | null;
  previous_partners?: Row[] | null;
};

type NameParts = { prefix: string; name: string; suffix: string };

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? value : String(value);
}

function record(value: unknown): Row {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Row)
    : {};
}

function list(value: unknown): Row[] {
  return Array.isArray(value) ? (value as Row[]) : [];
}

// Supabase מחזיר embed של יחיד כאובייקט או כמערך בן איבר אחד, תלוי אם קיים
// unique constraint על student_id — שני המקרים נתמכים כאן.
function single(value: unknown): Row | null {
  if (Array.isArray(value)) return value.length ? record(value[0]) : null;
  return value && typeof value === "object" ? (value as Row) : null;
}

function nameParts(value: unknown): NameParts {
  const parts = record(value);
  return {
    prefix: text(parts.prefix),
    name: text(parts.name),
    suffix: text(parts.suffix),
  };
}

// ה-datepicker כותב תאריכים בפורמט en-GB (DD/MM/YYYY), ועמודות date
// ב-Postgres חוזרות כ-ISO. ההמרה כאן שומרת על תצוגה עקבית בטופס.
function toDisplayDate(value: unknown): string {
  const raw = text(value).slice(0, 10);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!iso) return raw;
  return `${iso[3]}/${iso[2]}/${iso[1]}`;
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(text).filter(Boolean);
  // work_status היה עמודת text לפני המעבר ל-text[]; שורות ישנות עדיין
  // עשויות לחזור כמחרוזת בודדת.
  const single = text(value);
  return single ? [single] : [];
}

function educationEntries(rows: Row[], institutionType: string) {
  return rows
    .filter((row) => text(row.institution_type) === institutionType)
    .map((row) => ({
      // id הוא בורר "בחירה מתוך המאגר" בטופס, לא מזהה השורה — אין לו מקור
      // ב-education_history ולכן הוא נשאר ריק.
      id: "",
      name: text(row.name),
      community: text(row.community),
      city: text(row.city),
    }));
}

function referenceEntries(rows: Row[], referenceType: string) {
  return rows
    .filter((row) => text(row.reference_type) === referenceType)
    .map((row) => ({
      name: text(row.name),
      phone: text(row.phone),
      email: text(row.email),
      // "תפקיד" של רב לא נשמר ב-references ולכן אינו ניתן לשחזור.
      ...(referenceType === "rabbi" ? { role: "" } : {}),
    }));
}

function toEmployment(rows: Row[]): StudentFormValues["employment"] {
  const byCategory = (category: string) =>
    rows.find((row) => text(row.category) === category);

  const yeshiva = byCategory("yeshiva");
  const kolel = byCategory("kolel");
  const seminar = byCategory("seminar");
  const havruta = byCategory("havruta");
  const working = byCategory("working");
  const profession = byCategory("profession");

  return {
    // ה-tags נגזרים מהקטגוריות שנשמרו בפועל — הטופס לא שומר אותם בנפרד.
    tags: rows.map((row) => text(row.category)).filter(Boolean),
    yeshiva: text(yeshiva?.location),
    kolel: text(kolel?.location),
    seminar: text(seminar?.location),
    havruta: {
      with: text(havruta?.role),
      where: text(havruta?.location),
    },
    working: {
      role: text(working?.role),
      where: text(working?.location),
    },
    profession: {
      what: text(profession?.role),
      where: text(profession?.location),
    },
  };
}

function toMedical(row: Row | null): StudentFormValues["medical"] {
  if (!row) {
    return {
      status: "",
      exposureLevel: "",
      details: "",
      documents: [],
      contactForMoreInfo: "",
      otherContact: [],
      relatedIssuePreference: "",
    };
  }

  const contactInfo = record(row.contact_info);
  const contactType = text(contactInfo.type);

  return {
    status: text(row.status),
    exposureLevel: text(row.exposure_level),
    details: text(row.details),
    // הקבצים עצמם לא ניתנים לשחזור כ-File; הכתובות הקיימות נשמרות בנפרד
    // (ראה existingMedicalDocuments) ומצורפות בחזרה בשמירה.
    documents: [],
    contactForMoreInfo:
      contactType === "other"
        ? "other_contact"
        : contactType === "parents"
          ? "parents"
          : "",
    otherContact: list(contactInfo.contacts).map((contact) => ({
      name: text(contact.name),
      phone: text(contact.phone),
      email: text(contact.email),
    })),
    relatedIssuePreference: text(row.related_issue_preference),
  };
}

function toPartner(row: Row | null): StudentFormValues["partner"] {
  const preferredCountries = toStringArray(row?.preferred_countries);

  return {
    ageRange: {
      min: typeof row?.age_min === "number" ? row.age_min : 18,
      max: typeof row?.age_max === "number" ? row.age_max : 40,
    },
    // רשימת מדינות ריקה נשמרת דווקא כשנבחר "אין העדפה".
    preferredCountry: row
      ? preferredCountries.length
        ? "specific"
        : "all"
      : "",
    specificCountries: preferredCountries.map((name) => ({
      locale: "",
      name,
    })),
    workStatus: toStringArray(row?.work_status),
    headCoverType: text(row?.head_cover_type),
    planForLife: text(row?.plan_for_life),
    cellphoneType: text(row?.cellphone_type),
    aboutThePartner: text(row?.about_partner),
    additionalInformation: text(row?.additional_information),
  };
}

function toPreviousPartners(rows: Row[]) {
  return rows.map((row) => {
    const divorceDetails = record(row.divorce_details);
    return {
      separationType: text(row.separation_type),
      fullName: text(row.full_name),
      // previous_partners לא שומרת את פרטי ההורים של בן/בת הזוג הקודמים ולא
      // את מספר הילדים הנשואים — הם נמסרים בטופס אך אינם נכתבים ל-DB.
      parents: { fathersName: "", mothersName: "", address: "" },
      marriageDate: toDisplayDate(row.marriage_date),
      deathDate: toDisplayDate(row.death_date),
      childrenNumber: text(row.children_number),
      marriedChildrenNumber: "",
      divorce: {
        date: toDisplayDate(row.divorce_date),
        reason: text(divorceDetails.reason),
        rabbiName: text(divorceDetails.rabbiName),
        rabbiPhone: text(divorceDetails.rabbiPhone),
      },
    };
  });
}

export function studentToFormValues(
  student: StudentRowWithRelations,
): StudentFormValues {
  const parentsInfo = record(student.parents_info);
  const familyInfo = record(student.family_info);
  const authorInfo = record(student.author_info);
  const father = record(parentsInfo.father);
  const mother = record(parentsInfo.mother);
  const educationRows = list(student.education_history);
  const referenceRows = list(student.references);

  return {
    isOnShiduchim: student.in_shidduchim !== false,
    gender: text(student.gender),

    firstName: text(student.first_name),
    lastName: text(student.last_name),
    identityNumber: text(student.identity_number),
    birthDate: toDisplayDate(student.birth_date),
    // קבצים אינם ניתנים לשחזור כ-File; שדה ריק פירושו "לא הועלה קובץ חדש",
    // והקובץ הקיים נשמר כפי שהוא.
    image: { file: null },

    country: text(student.country),
    city: text(student.city),
    street: text(student.street),
    house: text(student.house),
    community: text(student.community),
    shtible: text(student.shtible),
    institutionId: text(student.institution_id),
    personalStatus: text(student.personal_status),
    height:
      student.height === null || student.height === undefined
        ? ""
        : text(student.height),
    cellphoneType: text(student.cellphone_type),
    phone: text(student.phone),
    planForLife: text(student.plan_for_life),
    headCoverType: text(student.head_cover_type),
    about: text(student.about),
    cv: { file: null },

    father: {
      self: nameParts(father.self),
      phone: text(father.phone),
      job: text(father.job),
      email: text(father.email),
      grandFather: nameParts(father.grandFather),
      grandMother: nameParts(father.grandMother),
    },

    mother: {
      self: nameParts(mother.self),
      maidenName: text(mother.maidenName),
      phone: text(mother.phone),
      job: text(mother.job),
      email: text(mother.email),
      grandFather: nameParts(mother.grandFather),
      grandMother: nameParts(mother.grandMother),
    },

    family: {
      numberOfChildren: text(familyInfo.numberOfChildren),
      currentChildPlace: text(familyInfo.currentChildPlace),
      about: text(familyInfo.about),
      mechutanim: list(familyInfo.mechutanim).map((mechutan) => ({
        id: text(mechutan.id),
        firstName: text(mechutan.firstName),
        lastName: text(mechutan.lastName),
        city: text(mechutan.city),
      })),
    },

    education: {
      yeshivaKtana: educationEntries(educationRows, "yeshiva_ktana"),
      yeshivaGdola: educationEntries(educationRows, "yeshiva_gdola"),
      kolel: educationEntries(educationRows, "kolel"),
      seminar: educationEntries(educationRows, "seminar"),
    },

    employment: toEmployment(list(student.employment_history)),

    previousPartners: toPreviousPartners(list(student.previous_partners)),
    knownRabbanim: referenceEntries(referenceRows, "rabbi"),
    knownFriends: referenceEntries(referenceRows, "friend"),
    knownFamilyFriends: referenceEntries(referenceRows, "family_friend"),

    parents: {
      status: text(parentsInfo.status),
      holding: text(parentsInfo.holding),
      deadParent: text(parentsInfo.deadParent),
      fatherDeathDate: toDisplayDate(parentsInfo.fatherDeathDate),
      motherDeathDate: toDisplayDate(parentsInfo.motherDeathDate),
      isMotherRemarried: text(parentsInfo.isMotherRemarried),
      newHusbandName: text(parentsInfo.newHusbandName),
      isFatherRemarried: text(parentsInfo.isFatherRemarried),
      newWifeName: text(parentsInfo.newWifeName),
    },

    medical: toMedical(single(student.medical_records)),
    partner: toPartner(single(student.partner_preferences)),

    author: {
      name: text(authorInfo.name),
      phone: text(authorInfo.phone),
      relation: text(authorInfo.relation),
    },
  };
}

/** כתובות המסמכים הרפואיים הקיימות — נשמרות כדי שעריכה לא תמחק אותן. */
export function existingMedicalDocuments(
  student: StudentRowWithRelations,
): string[] {
  const medical = single(student.medical_records);
  return toStringArray(medical?.documents);
}
