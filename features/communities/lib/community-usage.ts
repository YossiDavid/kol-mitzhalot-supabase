import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  Community,
  CommunityRow,
} from "@/features/communities/lib/community-form-schema";

/**
 * טעינת מאגר הקהילות יחד עם ספירת השימוש בכל ערך, למסך הניהול.
 *
 * הערך נשמר בכרטיס כטקסט (students.community, education_history.community)
 * ולא כמפתח זר, ולכן הספירה מגיעה מ-RPC של מנהל (admin_community_usage)
 * ולא מקשר במסד - וההשוואה שם היא lower(btrim(name)), בדיוק כמו האינדקס
 * הייחודי של הטבלה.
 */

const CATALOG_COLUMNS = "id, name, is_active, created_at";

/** אותו נרמול כמו במסד: lower(btrim(name)) */
export function communityNameKey(name: string): string {
  return name.trim().toLowerCase();
}

type UsageCountsRow = {
  name_key: string;
  students_count: number;
  education_count: number;
};

/** מה שמחזירה admin_merge_communities */
export type CommunityMergeResult = {
  source_name: string;
  target_name: string;
  students_updated: number;
  education_updated: number;
  rows_updated: number;
};

export async function loadCommunityRows(
  supabase: SupabaseClient,
): Promise<CommunityRow[]> {
  const [catalog, usage] = await Promise.all([
    supabase
      .from("communities")
      .select(CATALOG_COLUMNS)
      .order("name", { ascending: true }),
    supabase.rpc("admin_community_usage"),
  ]);

  if (catalog.error) {
    throw new Error(`טעינת מאגר הקהילות נכשלה: ${catalog.error.message}`);
  }
  if (usage.error) {
    throw new Error(`ספירת השימוש בקהילות נכשלה: ${usage.error.message}`);
  }

  const usageByKey = new Map<string, UsageCountsRow>(
    ((usage.data ?? []) as UsageCountsRow[]).map((row) => [row.name_key, row]),
  );

  return ((catalog.data ?? []) as Community[]).map((community) => {
    const counts = usageByKey.get(communityNameKey(community.name));
    const studentsCount = Number(counts?.students_count ?? 0);
    const educationCount = Number(counts?.education_count ?? 0);

    return {
      ...community,
      studentsCount,
      educationCount,
      usageCount: studentsCount + educationCount,
    };
  });
}

/** "רשומה אחת" / "3 רשומות" - כדי שהמספר 1 לא יופיע לצד לשון רבים */
export function describeRowCount(count: number): string {
  return count === 1 ? "רשומה אחת" : `${count} רשומות`;
}

/** תיאור השימוש בעברית, לדיאלוגים ולטבלה */
export function describeCommunityUsage(row: {
  studentsCount: number;
  educationCount: number;
}): string {
  const parts: string[] = [];

  if (row.studentsCount === 1) parts.push("כרטיס אחד");
  else if (row.studentsCount > 1) parts.push(`${row.studentsCount} כרטיסים`);

  if (row.educationCount === 1) parts.push("שורת השכלה אחת");
  else if (row.educationCount > 1) {
    parts.push(`${row.educationCount} שורות השכלה`);
  }

  return parts.length > 0 ? parts.join(" · ") : "לא בשימוש";
}
