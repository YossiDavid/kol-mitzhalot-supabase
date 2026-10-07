import { hasRole, type UserWithRole } from "@/lib/user-role";

/** קישור החזרה שבראש כרטיס המיועד ובמסכי העריכה שלו */
export type CardBackLink = { href: string; label: string };

const STUDENTS_LIST_BACK_LINK: CardBackLink = {
  href: "/app/students",
  label: "חזרה לרשימה",
};

const DASHBOARD_BACK_LINK: CardBackLink = {
  href: "/app",
  label: "חזרה לעמוד הראשי",
};

/**
 * ליעד החזרה מכרטיס. רשימת המיועדים (/app/students) פתוחה למנהל, שדכן ואיש
 * צוות בלבד (app/app/students/layout.tsx); כל משתמש מחובר אחר (הורה/בעל כרטיס)
 * חוזר לעמוד הראשי. גולש אנונימי אינו מקבל קישור חזרה.
 */
export function getCardBackLink(user: UserWithRole): CardBackLink | undefined {
  if (!user) return undefined;
  const canOpenStudentsList =
    hasRole(user, "admin") ||
    hasRole(user, "shadchan") ||
    hasRole(user, "staff");
  return canOpenStudentsList ? STUDENTS_LIST_BACK_LINK : DASHBOARD_BACK_LINK;
}
