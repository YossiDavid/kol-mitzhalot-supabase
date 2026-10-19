/**
 * מצב המועמד בלוח העבודה: תגים קצרים על כל כרטיס, כדי שהשדכן יראה לפני
 * השיבוץ שהמועמד אינו פנוי להצעה. העמודות נקראות מ-student_cards
 * (DESK_STUDENT_SELECT), ו"בתהליך" מהפונקציה students_in_process.
 */

export type CandidateStatusColumns = {
  gender?: "male" | "female" | string | null;
  in_shidduchim?: boolean | null;
  admin_paused_at?: string | null;
  personal_status?: string | null;
  /** יש הצעה פתוחה בסטטוס interested/in_progress (students_in_process) */
  is_in_process?: boolean;
};

export type CandidateStatusTone = "danger" | "warning" | "info";

export type CandidateStatus = {
  key: "married" | "engaged" | "admin_paused" | "inactive" | "in_process";
  label: string;
  tone: CandidateStatusTone;
};

function byGender(
  card: CandidateStatusColumns,
  male: string,
  female: string,
): string {
  return card.gender === "female" ? female : male;
}

/** התגים לפי סדר חומרה. כרטיס פנוי ופעיל - רשימה ריקה */
export function candidateStatuses(
  card: CandidateStatusColumns,
): CandidateStatus[] {
  const statuses: Array<CandidateStatus | null> = [
    card.personal_status === "married"
      ? { key: "married", label: byGender(card, "נשוי", "נשואה"), tone: "danger" }
      : null,
    card.personal_status === "engaged"
      ? {
          key: "engaged",
          label: byGender(card, "מאורס", "מאורסת"),
          tone: "danger",
        }
      : null,
    card.admin_paused_at
      ? { key: "admin_paused", label: "מושהה ע״י ההנהלה", tone: "warning" }
      : null,
    // השהיית הנהלה מכבה גם את in_shidduchim - אין צורך בשני תגים
    card.in_shidduchim === false && !card.admin_paused_at
      ? {
          key: "inactive",
          label: byGender(card, "לא פעיל בשידוכים", "לא פעילה בשידוכים"),
          tone: "warning",
        }
      : null,
    card.is_in_process
      ? { key: "in_process", label: "בתהליך", tone: "info" }
      : null,
  ];
  return statuses.filter((status): status is CandidateStatus => !!status);
}
