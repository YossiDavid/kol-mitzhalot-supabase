/** Server-side reads for shadchan cards, activity and contact quota (SECURITY DEFINER RPCs). */

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { describeSupabaseError } from "@/lib/supabase/describe-error";
import {
  SHADCHAN_ACTION_TYPES,
  type ContactQuota,
  type ShadchanActionType,
  type ShadchanActivity,
  type ShadchanFullProfile,
  type ShadchanPublicCard,
} from "./types";

export const DASHBOARD_SHADCHANIM_LIMIT = 6;

const FALLBACK_SHADCHAN_NAME = "שדכן";

const publicCardRowSchema = z.object({
  shadchan_id: z.string(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  avatar_url: z.string().nullable(),
  since_year: z.number().int().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  city: z.string().nullable(),
  description: z.string().nullable(),
});

const activityRowSchema = publicCardRowSchema.extend({
  last_action_at: z.string(),
  action_types: z.array(z.string()),
});

const fullProfileRowSchema = publicCardRowSchema.extend({
  experience_years: z.number().int().nullable(),
  closed_matches: z.number().int().nullable(),
  specializations: z.array(z.string()).nullable(),
  languages: z.array(z.string()).nullable(),
});

const quotaRowSchema = z.object({
  daily_limit: z.number().int(),
  used_today: z.number().int(),
  remaining_today: z.number().int(),
  is_exempt: z.boolean(),
  contacted_shadchan_ids: z.array(z.string()).nullable(),
  reply_shadchan_ids: z.array(z.string()).nullable(),
});

type PublicCardRow = z.infer<typeof publicCardRowSchema>;

function isShadchanActionType(value: string): value is ShadchanActionType {
  return (SHADCHAN_ACTION_TYPES as readonly string[]).includes(value);
}

function toPublicCard(row: PublicCardRow): ShadchanPublicCard {
  const name = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
  return {
    id: row.shadchan_id,
    name: name || FALLBACK_SHADCHAN_NAME,
    avatarUrl: row.avatar_url,
    sinceYear: row.since_year,
    phone: row.phone,
    email: row.email,
    city: row.city,
    description: row.description,
  };
}

/**
 * Shadchanim who acted on the current user's cards, newest first.
 * Returns null on failure so the UI can tell "error" apart from "none yet".
 */
export async function getShadchanimWhoActedForMe(
  limit: number = DASHBOARD_SHADCHANIM_LIMIT,
): Promise<ShadchanActivity[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "get_shadchanim_who_acted_for_me",
    { p_limit: limit },
  );
  if (error) {
    console.error("[shadchanim/acted-for-me]", describeSupabaseError(error));
    return null;
  }

  const parsed = z.array(activityRowSchema).safeParse(data ?? []);
  if (!parsed.success) {
    console.error("[shadchanim/acted-for-me] unexpected shape", parsed.error);
    return null;
  }

  return parsed.data.map((row) => ({
    ...toPublicCard(row),
    lastActionAt: row.last_action_at,
    actionTypes: row.action_types.filter(isShadchanActionType),
  }));
}

/** Daily contact quota of the current user. Null when unknown (the DB still enforces it). */
export async function getMyContactQuota(): Promise<ContactQuota | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_shadchan_contact_quota");
  if (error) {
    console.error("[shadchanim/contact-quota]", describeSupabaseError(error));
    return null;
  }

  const parsed = z.array(quotaRowSchema).safeParse(data ?? []);
  if (!parsed.success) {
    console.error("[shadchanim/contact-quota] unexpected shape", parsed.error);
    return null;
  }

  const row = parsed.data[0];
  if (!row) return null;
  return {
    dailyLimit: row.daily_limit,
    usedToday: row.used_today,
    remainingToday: row.remaining_today,
    isExempt: row.is_exempt,
    contactedShadchanIds: row.contacted_shadchan_ids ?? [],
    replyShadchanIds: row.reply_shadchan_ids ?? [],
  };
}

/** Public profile of one shadchan, or null if the id is not a shadchan. */
export async function getShadchanPublicProfile(
  shadchanId: string,
): Promise<ShadchanFullProfile | null> {
  if (!z.guid().safeParse(shadchanId).success) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_shadchan_public_profile", {
    p_shadchan_id: shadchanId,
  });
  if (error) {
    console.error("[shadchanim/profile]", describeSupabaseError(error));
    return null;
  }

  const parsed = z.array(fullProfileRowSchema).safeParse(data ?? []);
  if (!parsed.success) {
    console.error("[shadchanim/profile] unexpected shape", parsed.error);
    return null;
  }

  const row = parsed.data[0];
  if (!row) return null;
  return {
    ...toPublicCard(row),
    experienceYears: row.experience_years,
    closedMatches: row.closed_matches,
    specializations: row.specializations ?? [],
    languages: row.languages ?? [],
  };
}
