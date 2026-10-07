import { THIRD_PARTY_APPROVAL_COLUMNS } from "@/features/students/lib/third-party-card";

/**
 * מה שלוח העבודה קורא מכרטיס מועדף: התצוגה (שם, גיל, עיר, הורים, תעסוקה)
 * ובדיקות ההתאמה ב-compatibility.ts (מדינה, סטטוס, גובה, כיוון חיים, כיסוי
 * ראש, סוג טלפון והעדפות הצד השני). בלי עמודות הכרטיס הכבדות.
 *
 * parents_info עובר דרך העמודה המחושבת parents_info_for_viewer: בכרטיס צד
 * שלישי שלא אושר להצגה מלאה היא מחזירה שמות הורים בלבד (עיסוק וטלפון לא
 * נשלחים). card_for והאישורים מזינים את התג ואת חסימת השליחה בלוח.
 * partner_preferences נחסמת בכרטיס כזה ב-RLS.
 */
export const DESK_STUDENT_SELECT = `
  id,
  gender,
  first_name,
  last_name,
  birth_date,
  city,
  country,
  personal_status,
  height,
  plan_for_life,
  head_cover_type,
  cellphone_type,
  parents_info:parents_info_for_viewer,
  ${THIRD_PARTY_APPROVAL_COLUMNS},
  employment_history(category),
  partner_preferences(age_min, age_max, preferred_countries, work_status, head_cover_type, plan_for_life, cellphone_type)
`;
