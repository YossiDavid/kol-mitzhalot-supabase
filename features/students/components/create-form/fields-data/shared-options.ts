import type { FieldCondition } from "../field-visibility";
import type {
  FieldOptionDefinition,
  TextAndSelectField,
  UploadField,
} from "./types";

// אפשרויות ותנאים שחוזרים בכמה שלבים - מוגדרים פעם אחת

type TitlesConfig = Pick<
  TextAndSelectField,
  "prefixOptions" | "prefixPlaceholder" | "placeholder" | "options"
>;

function sameValueAndLabel(values: readonly string[]) {
  return values.map((value) => ({ value, label: value }));
}

/** שם של גבר (אב, סבא): תואר לפני ואחרי השם */
export const MALE_NAME_TITLES: TitlesConfig = {
  prefixOptions: sameValueAndLabel(["הרב", "הר״ר", "הרה״ח", "הרה״ג", "הרה״צ"]),
  prefixPlaceholder: "תואר לפני",
  placeholder: "תואר אחרי",
  options: sameValueAndLabel(["הי״ו", "שליט״א", "ז״ל", "זצ״ל", "זצוק״ל"]),
};

/** שם של אשה (אם, סבתא): תואר לפני ואחרי השם */
export const FEMALE_NAME_TITLES: TitlesConfig = {
  prefixOptions: sameValueAndLabel(["הגב׳", "הרבנית"]),
  prefixPlaceholder: "תואר לפני",
  placeholder: "תואר אחרי",
  options: sameValueAndLabel(["תחי׳", "תליט״א", "ע״ה"]),
};

/** סוג טלפון - של המיועד/ת ושל מי שמחפשים (cellphone_type_enum) */
export const CELLPHONE_TYPE_OPTIONS: FieldOptionDefinition[] = [
  { value: "kosher", label: "כשר" },
  { value: "sms", label: "SMS" },
  { value: "protected_smartphone", label: "סמארטפון מוגן" },
  { value: "other", label: "אחר" },
];

/** "מתעתד בעז״ה" - של המיועד ושל מי שמחפשים (plan_for_life_enum) */
export const PLAN_FOR_LIFE_OPTIONS: FieldOptionDefinition[] = [
  { value: "koilel", label: "ללמוד בכולל" },
  { value: "torah_job", label: "לעבוד בעבודה תורנית" },
  { value: "mix_torah_work", label: "לשלב תורה ועבודה" },
  { value: "work", label: "לעבוד" },
];

/** קבצים שמתקבלים בקו״ח ובמסמכים רפואיים */
export const DOCUMENT_ACCEPT: UploadField["accept"] = {
  "application/pdf": [".pdf"],
  "image/*": [".png", ".jpg", ".jpeg"],
};

/** מוצג רק למיועד או רק למיועדת */
export function genderIs(gender: "male" | "female"): FieldCondition[] {
  return [{ parameter: "gender", operator: "===", value: gender }];
}
