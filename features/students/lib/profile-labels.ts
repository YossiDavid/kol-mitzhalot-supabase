/** Hebrew labels for student profile / CV display (shared by summary + full views). */

export function eduToHebrew(edu: string) {
  switch (edu) {
    case "yeshiva_ktana":
      return "ישיבה קטנה";
    case "yeshiva_gdola":
      return "ישיבה גדולה";
    case "kolel":
      return "כולל";
    case "seminar":
      return "סמינר";
    default:
      return edu;
  }
}

export function personalStatusToHebrew(status: string, gender?: string) {
  const female = gender === "female";
  switch (status) {
    case "single":
      return female ? "רווקה" : "רווק";
    case "divorced":
      return female ? "גרושה" : "גרוש";
    case "widowed":
    case "widower":
      return female ? "אלמנה" : "אלמן";
    case "engaged":
      return female ? "מאורסת" : "מאורס";
    case "married":
      return female ? "נשואה" : "נשוי";
    default:
      return status;
  }
}

export function medicalStatusToHebrew(status: string) {
  switch (status) {
    case "good":
      return "תקין";
    case "littleProblem":
      return "בעיה קלה";
    case "hugeProblem":
      return "בעיה משמעותית";
    default:
      return status;
  }
}

export function cellphoneTypeToHebrew(type: string) {
  switch (type) {
    case "kosher":
      return "כשר";
    case "sms":
      return "SMS";
    case "protected_smartphone":
      return "סמארטפון מוגן";
    case "other":
      return "אחר";
    default:
      return type;
  }
}

export function planForLifeToHebrew(plan: string) {
  switch (plan) {
    case "koilel":
      return "ללמוד בכולל";
    case "torah_job":
      return "לעבוד בעבודה תורנית";
    case "mix_torah_work":
      return "לשלב תורה ועבודה";
    case "work":
      return "לעבוד";
    default:
      return plan;
  }
}

export function headCoverTypeToHebrew(type: string) {
  switch (type) {
    case "kerchief":
      return "מטפחת";
    case "wig":
      return "פאה";
    case "kerchief_on_wig":
      return "מטפחת על פאה";
    case "other":
      return "אחר";
    default:
      return type;
  }
}

export function employmentCategoryToHebrew(category: string) {
  switch (category) {
    case "yeshiva":
      return "לומד בישיבה";
    case "kolel":
      return "אברך כולל";
    case "seminar":
      return "תלמידת סמינר";
    case "havruta":
      return "לומד עם חברותא";
    case "working":
      return "עובד";
    case "profession":
      return "לומד מקצוע";
    default:
      return category;
  }
}

export function referenceTypeToHebrew(type: string) {
  switch (type) {
    case "rabbi":
      return "רב";
    case "friend":
      return "חבר";
    case "family_friend":
      return "מכר משפחתי";
    default:
      return type;
  }
}

export function parentsStatusToHebrew(status: string) {
  switch (status) {
    case "married":
      return "נשואים";
    case "divorced":
      return "גרושים";
    case "widowed":
      return "אלמן/ה";
    default:
      return status;
  }
}

/** ניסוח לפי מגדר המיועד/ת שמחפשים (הפוך למגדר בעל הכרטיס) */
const WORK_STATUS_LABELS: Record<string, { male: string; female: string }> = {
  student: { male: "תלמיד", female: "תלמידת סמינר" },
  seminar: { male: "תלמיד", female: "תלמידת סמינר" },
  yeshiva: { male: "לומד בישיבה", female: "לומדת" },
  kolel: { male: "אברך כולל", female: "אברך כולל" },
  chavruta: { male: "לומד עם חברותא", female: "לומדת עם חברותא" },
  working: { male: "עובד", female: "עובדת" },
  profession_student: { male: "לומד מקצוע", female: "לומדת מקצוע" },
  at_home: { male: "בבית", female: "בבית" },
  other: { male: "לא משנה", female: "לא משנה" },
};

/** ניסוח דו-מגדרי, כשמגדר בעל הכרטיס לא ידוע */
const WORK_STATUS_NEUTRAL: Record<string, string> = {
  student: "תלמידה",
  seminar: "תלמידת סמינר",
  working: "עובד/ת",
  yeshiva: "תלמיד ישיבה",
  kolel: "אברך כולל",
  chavruta: "לומד עם חברותא",
  profession_student: "לומד/ת מקצוע",
  at_home: "בבית",
  other: "לא משנה",
};

/**
 * הסטטוס מתאר את מי שמחפשים, ולכן הניסוח הוא במגדר ההפוך לזה של
 * בעל הכרטיס. השדה נשמר כמערך (בחירה מרובה); מחרוזת בודדת נתמכת
 * לצורך תאימות לרשומות שנוצרו לפני המעבר.
 */
export function workStatusToHebrew(
  status: string | string[] | null | undefined,
  studentGender?: string | null,
) {
  const values = Array.isArray(status) ? status : status ? [status] : [];
  if (values.length === 0) return "";

  const targetGender =
    studentGender === "male"
      ? "female"
      : studentGender === "female"
        ? "male"
        : null;

  return values
    .map((value) =>
      targetGender
        ? (WORK_STATUS_LABELS[value]?.[targetGender] ?? value)
        : (WORK_STATUS_NEUTRAL[value] ?? value),
    )
    .join(", ");
}

export function exposureLevelToHebrew(level: string) {
  switch (level) {
    case "no_exposure":
      return "הסתרת עצם קיומה של הבעיה";
    case "basic_exposure":
      return "חשיפת רמת הבעיה בלבד עם פרטי יצירת קשר למידע נוסף";
    case "only_for_kol_mitzhalot":
      return "חשיפת פרטי הבעיה להנהלת קול מצהלות בלבד";
    case "full_exposure":
      return "חשיפת הבעיה ופרטיה לכלל השדכנים";
    default:
      return level;
  }
}

export function relatedIssuePreferenceToHebrew(pref: string) {
  switch (pref) {
    case "same_issue":
      return "עם בעיה רפואית זהה";
    case "similar_or_other":
      return "בעיה רפואית דומה או אחרת באותה רמה";
    case "no_issue":
      return "ללא בעיה רפואית";
    default:
      return pref;
  }
}
