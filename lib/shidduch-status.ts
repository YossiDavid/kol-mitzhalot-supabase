export const SHIDDUCH_STATUS_VALUES = [
  "draft",
  "sent",
  "waiting_response",
  "interested",
  "more_info_needed",
  "in_progress",
  "rejected",
  "completed",
] as const;

export type ShidduchStatus = (typeof SHIDDUCH_STATUS_VALUES)[number];

export const SHIDDUCH_STATUS_LABELS: Record<ShidduchStatus, string> = {
  draft: "טיוטה",
  sent: "נשלחה",
  waiting_response: "ממתינים לתגובה",
  interested: "מתעניינים",
  more_info_needed: "נדרש מידע נוסף",
  in_progress: "בתהליך",
  rejected: "לא רלוונטי",
  completed: "הושלם",
};

export const SHIDDUCH_STATUS_BADGE_CLASS: Record<ShidduchStatus, string> = {
  draft: "bg-slate-100 text-slate-700 border-slate-200",
  sent: "bg-blue-100 text-blue-800 border-blue-200",
  waiting_response: "bg-amber-100 text-amber-800 border-amber-200",
  interested: "bg-emerald-100 text-emerald-800 border-emerald-200",
  more_info_needed: "bg-orange-100 text-orange-800 border-orange-200",
  in_progress: "bg-violet-100 text-violet-800 border-violet-200",
  rejected: "bg-rose-100 text-rose-800 border-rose-200",
  completed: "bg-green-100 text-green-800 border-green-200",
};

export const SHIDDUCH_STATUS_OPTIONS = SHIDDUCH_STATUS_VALUES.map((value) => ({
  value,
  label: SHIDDUCH_STATUS_LABELS[value],
}));

export function isShidduchStatus(value: string): value is ShidduchStatus {
  return (SHIDDUCH_STATUS_VALUES as readonly string[]).includes(value);
}
