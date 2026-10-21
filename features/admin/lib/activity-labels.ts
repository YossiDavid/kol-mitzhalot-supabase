import {
  APPLICATION_STATUS_LABELS,
  type ApplicationStatus,
} from "@/lib/application-status";
import { getRoleLabel, type Role } from "@/lib/user";
import { personalStatusToHebrew } from "@/features/students/lib/profile-labels";
import {
  SHIDDUCH_STATUS_LABELS,
  isShidduchStatus,
} from "@/features/shidduchim/lib/status";

/**
 * ניסוח שורות יומן הפעילות: שם הפעולה, הקישור לישות, ותיאור קצר של מה
 * שהשתנה (מתוך details - שמות עמודות וערכי סטטוס בלבד).
 */

export const ACTIVITY_ACTION_LABELS: Record<string, string> = {
  "student.created": "כרטיס נוצר",
  "student.updated": "כרטיס עודכן",
  "student.approved": "כרטיס אושר",
  "student.rejected": "כרטיס נדחה",
  "student.paused": "כרטיס הושהה ע״י ההנהלה",
  "student.unpaused": "השהיית כרטיס בוטלה",
  "student.deleted": "כרטיס נמחק",
  "student.restored": "כרטיס שוחזר",
  "student.purged": "כרטיס נמחק לצמיתות",
  "student.personal_status": "סטטוס אישי השתנה",
  "student.in_shidduchim": "השתתפות בשידוכים השתנתה",
  "shidduch.created": "הצעה נוצרה",
  "shidduch.status": "סטטוס הצעה השתנה",
  "shidduch.scope": "הצעה נשלחה לצד נוסף",
  "shadchan_application.status": "בקשת שדכן",
  "user.roles": "תפקידים עודכנו",
  "announcement.shadchanim": "הודעה נשלחה לכל השדכנים",
};

/** תוויות לעמודות הכרטיס שנרשמות ב-details.changed */
const STUDENT_COLUMN_LABELS: Record<string, string> = {
  user_id: "מנהל הכרטיס",
  first_name: "שם פרטי",
  last_name: "שם משפחה",
  gender: "מגדר",
  birth_date: "תאריך לידה",
  personal_status: "סטטוס אישי",
  in_shidduchim: "בשידוכים",
  card_for: "עבור מי הכרטיס",
  admin_approved_at: "אישור הנהלה",
  admin_rejected_at: "דחיית הנהלה",
  admin_paused_at: "השהיית הנהלה",
  deleted_at: "מחיקה",
  third_party_full_display_approved_at: "אישור הצגה מלאה",
  third_party_proposals_approved_at: "אישור קבלת הצעות",
  proposal_limit_count: "מכסת הצעות",
  proposal_limit_period: "תקופת מכסה",
  is_kohen: "כהן",
};

const SCOPE_LABELS: Record<string, string> = {
  both: "שני הצדדים",
  groom_only: "צד המיועד",
  bride_only: "צד המיועדת",
};

export function activityActionLabel(action: string): string {
  return ACTIVITY_ACTION_LABELS[action] ?? action;
}

/** קישור לישות, אם יש לה דף */
export function activityEntityHref(
  entityType: string,
  entityId: string | null,
): string | null {
  if (!entityId) return null;
  if (entityType === "student") return `/app/students/${entityId}`;
  if (entityType === "shidduch") return `/app/shidduchim/${entityId}`;
  if (entityType === "shadchan_application" || entityType === "user") {
    return `/app/admin/users/${entityId}`;
  }
  return null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function shidduchStatusLabel(value: unknown): string | null {
  const status = text(value);
  if (!status) return null;
  return isShidduchStatus(status) ? SHIDDUCH_STATUS_LABELS[status] : status;
}

function applicationStatusLabel(value: unknown): string | null {
  const status = text(value);
  if (!status) return null;
  return APPLICATION_STATUS_LABELS[status as ApplicationStatus] ?? status;
}

function transition(from: string | null, to: string | null): string | null {
  if (!to) return null;
  return from ? `${from} ← ${to}` : to;
}

function rolesLabel(value: unknown): string {
  const roles = Array.isArray(value) ? value.map(String) : [];
  return roles.length > 0
    ? roles.map((role) => getRoleLabel(role as Role)).join(", ")
    : "משתמש";
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function studentDetails(details: Record<string, unknown>): string | null {
  const status = asRecord(details.personal_status);
  if (text(status.to)) {
    return transition(
      text(status.from) ? personalStatusToHebrew(String(status.from)) : null,
      personalStatusToHebrew(String(status.to)),
    );
  }
  const changed = Array.isArray(details.changed) ? details.changed : [];
  if (changed.length === 0) return null;
  return changed
    .map((column) => STUDENT_COLUMN_LABELS[String(column)] ?? String(column))
    .join(", ");
}

/** תיאור קצר של מה שהשתנה, או null */
export function activityDetailsText(
  entityType: string,
  details: Record<string, unknown>,
): string | null {
  if (entityType === "shidduch") {
    const statuses = transition(
      shidduchStatusLabel(details.status_from),
      shidduchStatusLabel(details.status_to),
    );
    const scope = text(details.scope_to);
    const scopeText = scope ? `נשלחה ל${SCOPE_LABELS[scope] ?? scope}` : null;
    return [statuses, scopeText].filter(Boolean).join(" · ") || null;
  }
  if (entityType === "shadchan_application") {
    return transition(
      applicationStatusLabel(details.status_from),
      applicationStatusLabel(details.status_to),
    );
  }
  if (entityType === "user") {
    return `${rolesLabel(details.roles_from)} ← ${rolesLabel(details.roles_to)}`;
  }
  if (entityType === "student") return studentDetails(details);
  if (entityType === "announcement") {
    const recipients = Number(details.recipients);
    return Number.isFinite(recipients) ? `${recipients} נמענים` : null;
  }
  return null;
}
