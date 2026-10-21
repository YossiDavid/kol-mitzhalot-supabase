import { FAVORITABLE_COLUMNS } from "@/features/students/lib/third-party-card";

/**
 * מה שלוח העבודה קורא מכרטיס מועדף: התצוגה (שם, גיל, עיר, הורים, תעסוקה)
 * ובדיקות ההתאמה ב-compatibility.ts (מדינה, סטטוס, גובה, כיוון חיים, כיסוי
 * ראש, סוג טלפון והעדפות הצד השני). בלי עמודות הכרטיס הכבדות.
 *
 * נקרא מ-student_cards (STUDENT_CARDS_VIEW), לא מ-students: בכרטיס צד שלישי
 * שלא אושר להצגה מלאה ה-view מחזיר נתונים בסיסיים בלבד - parents_info עם
 * שמות הורים בלבד, כיוון חיים וכיסוי ראש ריקים - ו-partner_preferences נחסמת
 * ב-RLS, כך שלבדיקת ההתאמה פשוט אין מה להשוות. card_for והאישורים מזינים את
 * התג, את חסימת השליחה בלוח ואת הסינון של כרטיס שאינו מאושר (isFavoritable). is_kohen מזין את כלל הכהן והגרושה; in_shidduchim, admin_paused_at ו-personal_status
 * מזינים גם את תגי מצב המועמד (candidate-status.ts).
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
  is_kohen,
  in_shidduchim,
  admin_paused_at,
  height,
  plan_for_life,
  head_cover_type,
  cellphone_type,
  parents_info,
  ${FAVORITABLE_COLUMNS},
  employment_history(category),
  partner_preferences(age_min, age_max, preferred_countries, work_status, head_cover_type, plan_for_life, cellphone_type)
`;
