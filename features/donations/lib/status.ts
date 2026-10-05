/** סטטוס תרומה: תוויות ותגים לתצוגה (מנהל) ולבדיקת הטיפוס מהמסד */
export const DONATION_STATUSES = ["pending", "paid", "mismatch"] as const;
export type DonationStatus = (typeof DONATION_STATUSES)[number];

export const DONATION_STATUS_LABELS: Record<DonationStatus, string> = {
  pending: "ממתין",
  paid: "שולם",
  mismatch: "אי-התאמה",
};

/** תרומה ממתינה שיש לה רק עסקה זמנית: הספק עוד לא שלח מספר אישור */
export const AWAITING_CLEARANCE_LABEL = "ממתין לאישור סליקה";

export const DONATION_STATUS_BADGE_VARIANT: Record<
  DonationStatus,
  "warning" | "success" | "danger"
> = {
  pending: "warning",
  paid: "success",
  mismatch: "danger",
};

export function isDonationStatus(value: unknown): value is DonationStatus {
  return DONATION_STATUSES.some((status) => status === value);
}
