/**
 * הטיפוסים של כרטיס המיועד. הם רופפים בכוונה: שורת ה-`students` מגיעה
 * מ-`select("*")` עם embeds, ועמודות ה-JSON (`parents_info`, `family_info`,
 * `author_info`) הן `Record<string, any>` במסד. הרכיבים כאן רק מציגים אותן.
 */

/** שם עם תואר לפני ואחרי, כפי שהוא נשמר ב-parents_info */
export type NameWithTitles = {
  prefix?: string | null;
  name?: string | null;
  suffix?: string | null;
};

export type ParentInfo = {
  self?: NameWithTitles | null;
  job?: string | null;
  phone?: string | null;
  email?: string | null;
  grandFather?: NameWithTitles | null;
  grandMother?: NameWithTitles | null;
  maidenName?: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ParentsInfo = Record<string, any> | null | undefined;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FamilyInfo = Record<string, any> | null | undefined;

export type EducationEntry = {
  name?: string;
  institution_type?: string;
  community?: string;
  city?: string;
};

export type EmploymentEntry = {
  category?: string;
  role?: string;
  location?: string;
  description?: string;
};

export type ReferenceEntry = {
  reference_type?: string;
  name?: string;
  phone?: string;
  email?: string;
};

export type PreviousPartnerEntry = {
  full_name?: string;
  separation_type?: string;
  marriage_date?: string;
  divorce_date?: string;
  death_date?: string;
  children_number?: number;
  children?: unknown;
  divorce_details?: {
    reason?: string;
    rabbiName?: string;
    rabbiPhone?: string;
  };
};

export type MechutanEntry = {
  firstName?: string;
  lastName?: string;
  city?: string;
};

/**
 * הפרטים האישיים שמוצגים בכרטיס. בענף הציבורי (גולש לא מחובר) השדות
 * הרגישים אינם קיימים כלל באובייקט - לא "ריקים" - ולכן הם אופציונליים כאן,
 * ו-`InfoTag` פשוט לא מרנדר אותם. ראו `features/students/lib/student-card-data.ts`.
 */
export type PersonalDetails = {
  gender?: string | null;
  city?: string | null;
  height?: number | null;
  community?: string | null;
  shtible?: string | null;
  plan_for_life?: string | null;
  head_cover_type?: string | null;
  personal_status?: string | null;
  about?: string | null;
  /** רק למשתמש מחובר */
  street?: string | null;
  house?: string | null;
  country?: string | null;
  identity_number?: string | null;
  phone?: string | null;
  cellphone_type?: string | null;
  in_shidduchim?: boolean | null;
};
