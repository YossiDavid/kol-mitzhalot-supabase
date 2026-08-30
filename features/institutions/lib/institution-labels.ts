// מקור אמת יחיד לתוויות בעברית של מוסדות לימוד (institutions.type / institutions.gender).
// נצרך ע"י מסך ניהול מוסדות למנהל (app/app/admin/institutions/page.tsx) וע"י
// בורר המוסד באשף יצירת כרטיס מיועד (features/students/components/create-form).
// אין לשכפל את המחרוזות האלה במקום אחר בקוד.

export const INSTITUTION_TYPES = [
  "yeshiva_gedola",
  "yeshiva_ketana",
  "seminary",
  "school",
  "talmud_torah",
  "kollel",
  "other",
] as const;

export type InstitutionType = (typeof INSTITUTION_TYPES)[number];

export const INSTITUTION_GENDERS = ["male", "female"] as const;

export type InstitutionGender = (typeof INSTITUTION_GENDERS)[number];

export const INSTITUTION_TYPE_LABELS: Record<InstitutionType, string> = {
  yeshiva_gedola: "ישיבה גדולה",
  yeshiva_ketana: "ישיבה קטנה",
  seminary: "סמינר",
  school: "בית ספר",
  talmud_torah: "תלמוד תורה",
  kollel: "כולל",
  other: "אחר",
};

export const INSTITUTION_GENDER_LABELS: Record<InstitutionGender, string> = {
  male: "בנים",
  female: "בנות",
};

export const INSTITUTION_TYPE_OPTIONS: {
  value: InstitutionType;
  label: string;
}[] = INSTITUTION_TYPES.map((value) => ({
  value,
  label: INSTITUTION_TYPE_LABELS[value],
}));

export const INSTITUTION_GENDER_OPTIONS: {
  value: InstitutionGender;
  label: string;
}[] = INSTITUTION_GENDERS.map((value) => ({
  value,
  label: INSTITUTION_GENDER_LABELS[value],
}));
