import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { describeSupabaseError } from "@/lib/supabase/describe-error";
import { israelDayStartIso } from "@/features/admin/lib/proposals-report";
import {
  ACTIVITY_PAGE_SIZE,
  isUuid,
  type ActivityLogQuery,
} from "@/features/admin/lib/activity-log-query";

/**
 * יומן הפעילות לניהול (public.activity_log). הקריאה בסשן של המשתמש - מדיניות
 * ה-RLS מחזירה שורות למנהל בלבד. שמות המבצעים מ-user_profiles (גם היא נקראת
 * למנהל).
 */

/** כמה משתמשים לכל היותר מתאימים לחיפוש מבצע לפי שם */
const ACTOR_SEARCH_LIMIT = 50;

const activityRowSchema = z.object({
  id: z.string(),
  at: z.string(),
  actor_id: z.string().nullable(),
  action: z.string(),
  entity_type: z.string(),
  entity_id: z.string().nullable(),
  summary: z.string(),
  details: z.record(z.string(), z.unknown()).nullable(),
});

export type ActivityRow = {
  id: string;
  at: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  details: Record<string, unknown>;
};

export type ActivityLogPage = { rows: ActivityRow[]; total: number };

type ServerClient = Awaited<ReturnType<typeof createClient>>;

function escapeIlike(value: string): string {
  return value.replace(/[\\%_,()]/g, (char) => `\\${char}`);
}

/** מזהי המשתמשים שהשם או האימייל שלהם מכילים את הטקסט */
async function findActorIds(
  supabase: ServerClient,
  text: string,
): Promise<string[]> {
  const pattern = `%${escapeIlike(text)}%`;
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id")
    .or(
      `first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern}`,
    )
    .limit(ACTOR_SEARCH_LIMIT);
  if (error) {
    console.error("[admin/activity] actor search", describeSupabaseError(error));
    throw new Error("חיפוש המבצע נכשל");
  }
  return (data ?? []).map((row) => row.id as string);
}

async function loadActorNames(
  supabase: ServerClient,
  ids: readonly string[],
): Promise<ReadonlyMap<string, string>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, first_name, last_name, email")
    .in("id", [...ids]);
  if (error) {
    console.error("[admin/activity] actor names", describeSupabaseError(error));
    return new Map();
  }
  return new Map(
    (data ?? []).map((row) => {
      const name = [row.first_name, row.last_name]
        .map((part: string | null) => part?.trim())
        .filter(Boolean)
        .join(" ");
      return [row.id as string, name || (row.email as string | null) || ""];
    }),
  );
}

/** מזהי המבצעים לסינון: null = בלי סינון; מערך ריק = אין התאמה */
async function resolveActorFilter(
  supabase: ServerClient,
  actor: string,
): Promise<string[] | null> {
  if (!actor) return null;
  if (isUuid(actor)) return [actor];
  return findActorIds(supabase, actor);
}

export async function loadActivityLog(
  query: ActivityLogQuery,
): Promise<ActivityLogPage> {
  const supabase = await createClient();
  const actorIds = await resolveActorFilter(supabase, query.actor);
  if (actorIds !== null && actorIds.length === 0) return { rows: [], total: 0 };

  let builder = supabase
    .from("activity_log")
    .select(
      "id, at, actor_id, action, entity_type, entity_id, summary, details",
      { count: "exact" },
    );
  if (query.entity) builder = builder.eq("entity_type", query.entity);
  if (actorIds) builder = builder.in("actor_id", actorIds);
  if (query.from) builder = builder.gte("at", israelDayStartIso(query.from));
  if (query.to) builder = builder.lt("at", israelDayStartIso(query.to, 1));

  const rangeStart = (query.page - 1) * ACTIVITY_PAGE_SIZE;
  const { data, count, error } = await builder
    .order("at", { ascending: false })
    .range(rangeStart, rangeStart + ACTIVITY_PAGE_SIZE - 1);

  if (error) {
    console.error("[admin/activity] load", describeSupabaseError(error));
    throw new Error("טעינת יומן הפעילות נכשלה");
  }

  const parsed = z.array(activityRowSchema).safeParse(data ?? []);
  if (!parsed.success) {
    console.error("[admin/activity] unexpected shape", parsed.error.issues);
    throw new Error("טעינת יומן הפעילות נכשלה");
  }

  const ids = [
    ...new Set(
      parsed.data.flatMap((row) => (row.actor_id ? [row.actor_id] : [])),
    ),
  ];
  const names = await loadActorNames(supabase, ids);

  return {
    total: count ?? 0,
    rows: parsed.data.map((row) => ({
      id: row.id,
      at: row.at,
      actorId: row.actor_id,
      actorName: row.actor_id ? (names.get(row.actor_id) ?? null) : null,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      summary: row.summary,
      details: row.details ?? {},
    })),
  };
}
