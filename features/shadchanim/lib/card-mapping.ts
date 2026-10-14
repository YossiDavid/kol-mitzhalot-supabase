import type { ShadchanPublicCard } from "./types";

/** שורת הכרטיס הציבורי כפי ש-list_approved_shadchanim מחזירה אותה */
export interface PublicCardRow {
  shadchan_id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  since_year: number | null;
  city: string | null;
  description: string | null;
  specializations?: string[] | null;
}

const FALLBACK_SHADCHAN_NAME = "שדכן";

/**
 * שורת RPC → כרטיס. המיפוי היחיד: הרשימה, הדשבורד והתצוגה המקדימה בטופס
 * השדכן עוברים כולם דרכו, כדי שהתצוגה המקדימה לא תתרחק מהכרטיס האמיתי.
 */
export function toPublicCard(row: PublicCardRow): ShadchanPublicCard {
  const name = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
  return {
    id: row.shadchan_id,
    name: name || FALLBACK_SHADCHAN_NAME,
    avatarUrl: row.avatar_url,
    sinceYear: row.since_year,
    city: row.city,
    description: row.description,
    specializations: row.specializations ?? [],
  };
}
