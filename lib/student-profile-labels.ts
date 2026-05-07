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

export function personalStatusToHebrew(status: string) {
  switch (status) {
    case "single":
      return "רווק";
    case "divorced":
      return "גרוש";
    case "widower":
      return "אלמן";
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

export function workStatusToHebrew(status: string) {
  switch (status) {
    case "student":
      return "תלמידה";
    case "working":
      return "עובד/ת";
    case "yeshiva":
      return "תלמיד ישיבה";
    case "chavruta":
      return "לומד עם חברותא";
    case "profession_student":
      return "לומד/ת מקצוע";
    case "other":
      return "לא משנה";
    default:
      return status;
  }
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
