/** מזהה העוגן של אזור השרשורים בעמוד ההצעה (קיים כבר ברינדור השרת). */
export const PROPOSAL_THREAD_ANCHOR = "proposal-thread";

/** עוגן של שרשור מול משתמש מסוים - אותו מזהה שמופיע בקישור ההתראה. */
export function proposalThreadAnchor(otherUserId: string): string {
  return `${PROPOSAL_THREAD_ANCHOR}-${otherUserId}`;
}
