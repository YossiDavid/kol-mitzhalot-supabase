/**
 * מכסת ההצעות שמנהל כרטיס קובע לכרטיס: מספר ותקופה, או "ללא הגבלה".
 * הטווחים משקפים את אילוצי students_proposal_limit_*_check במסד.
 */

export const PROPOSAL_LIMIT_PERIODS = ["day", "week", "month"] as const;
export type ProposalLimitPeriod = (typeof PROPOSAL_LIMIT_PERIODS)[number];

export const PROPOSAL_LIMIT_MIN = 1;
export const PROPOSAL_LIMIT_MAX = 100;

export const PROPOSAL_LIMIT_PERIOD_LABELS: Record<ProposalLimitPeriod, string> =
  {
    day: "יום",
    week: "שבוע",
    month: "חודש",
  };

export type ProposalLimit = {
  count: number | null;
  period: ProposalLimitPeriod | null;
};

const PERIOD_PER_LABELS: Record<ProposalLimitPeriod, string> = {
  day: "ליום",
  week: "לשבוע",
  month: "לחודש",
};

/** "3 הצעות לשבוע" או "ללא הגבלה" */
export function describeProposalLimit(limit: ProposalLimit): string {
  if (limit.count === null || limit.period === null) return "ללא הגבלה";
  const noun = limit.count === 1 ? "הצעה" : "הצעות";
  return `${limit.count} ${noun} ${PERIOD_PER_LABELS[limit.period]}`;
}
