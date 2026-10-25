import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";
import { fetchAllAuthUsers } from "@/features/admin/lib/users";
import { resolveDisplayName } from "@/lib/user-display-name";
import { hasRole } from "@/lib/user-role";
import type { AdminShadchanimQuery } from "@/features/admin/lib/shadchanim-query";

export type { AdminShadchanimQuery };

export type ShadchanApplicationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | null;

/** תיאור ציבורי קצר מזה (באותיות, אחרי trim) מסומן לתיקון בטבלת המנהל */
export const SHORT_DESCRIPTION_MAX_LENGTH = 20;

export type ShadchanAdminRow = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  applicationStatus: ShadchanApplicationStatus;
  applicationStatusLabel: string;
  totalShidduchim: number;
  completedShidduchim: number;
  lastShidduchCreatedAt: string | null;
  lastShidduchCompletedAt: string | null;
  /** הפעילות האחרונה: המאוחרת מבין הצעה אחרונה להתחברות אחרונה */
  lastActivityAt: string | null;
  /** שדכן מאושר שהתיאור הציבורי שלו ריק או קצר מאוד (לתיקון בידי מנהל) */
  hasMissingOrShortDescription: boolean;
  /** המנהל הקפיא את השדכן (shadchanim_info.frozen_at) */
  isFrozen: boolean;
  /** יש למשתמש תפקיד shadchan כרגע (אפשר להסיר הרשאות) */
  hasShadchanRole: boolean;
  /** יש שורת shadchanim_info (אפשר להקפיא) */
  hasProfileRow: boolean;
  /** user_profiles.last_seen_at */
  lastSeenAt: string | null;
  /** הערכת זמן הפעילות המצטבר (user_profiles.active_seconds) */
  activeSeconds: number;
};

type ActivityStats = { lastSeenAt: string | null; activeSeconds: number };

const NO_ACTIVITY: ActivityStats = { lastSeenAt: null, activeSeconds: 0 };

/** נראה לאחרונה וזמן פעילות לכל המשתמשים ברשימה (לשורות ולמיון) */
async function loadActivityStats(
  adminClient: ReturnType<typeof createAdminClient>,
  userIds: string[],
): Promise<Map<string, ActivityStats>> {
  const map = new Map<string, ActivityStats>();
  if (userIds.length === 0) return map;
  const { data, error } = await adminClient
    .from("user_profiles")
    .select("id, last_seen_at, active_seconds")
    .in("id", userIds);
  if (error) {
    console.error("[admin-shadchanim] user_profiles activity:", error);
    return map;
  }
  for (const row of data ?? []) {
    map.set(row.id, {
      lastSeenAt: row.last_seen_at,
      activeSeconds: Number(row.active_seconds ?? 0),
    });
  }
  return map;
}

function sortEntries(
  entries: ShadchanListEntry[],
  activity: Map<string, ActivityStats>,
  sort: AdminShadchanimQuery["sort"],
): ShadchanListEntry[] {
  if (!sort || sort === "submitted") return entries;
  const valueOf = (entry: ShadchanListEntry): number => {
    const stats = activity.get(entry.userId) ?? NO_ACTIVITY;
    if (sort === "active_time") return stats.activeSeconds;
    return stats.lastSeenAt ? new Date(stats.lastSeenAt).getTime() : 0;
  };
  return [...entries].sort((a, b) => valueOf(b) - valueOf(a));
}

export type AdminShadchanimListResult = {
  rows: ShadchanAdminRow[];
  total: number;
  page: number;
  perPage: number;
  lastPage: number;
  pendingCount: number;
};

const STATUS_LABELS: Record<string, string> = {
  pending: "ממתין לאישור",
  approved: "מאושר",
  rejected: "נדחה",
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function statusLabel(status: ShadchanApplicationStatus): string {
  if (status == null) return "שדכן (ללא בקשה)";
  return STATUS_LABELS[status] ?? status;
}

type ShadchanListEntry = {
  userId: string;
  applicationStatus: ShadchanApplicationStatus;
  sortAt: number;
  bio: string | null;
  isFrozen: boolean;
  hasProfileRow: boolean;
};

/** המאוחר מבין שני תאריכי ISO (או null כששניהם חסרים) */
function latestOf(a: string | null, b: string | null): string | null {
  if (!a || !b) return a ?? b;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

/** רק שדכן מאושר מופיע ברשימה הציבורית, ולכן רק לו התיאור רלוונטי */
function isDescriptionMissingOrShort(
  status: ShadchanApplicationStatus,
  bio: string | null,
): boolean {
  if (status !== "approved") return false;
  return (bio ?? "").trim().length < SHORT_DESCRIPTION_MAX_LENGTH;
}

async function loadShidduchimStats(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const { data: shidduchim, error } = await supabase
    .from("shidduchim")
    .select("created_at, status, updated_at")
    .eq("shadchan_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(`[admin-shadchanim] shidduchim for ${userId}:`, error);
  }

  const shidduchimData = shidduchim || [];
  const completedShidduchim = shidduchimData.filter(
    (s) => s.status === "completed",
  );
  const lastShidduch = shidduchimData[0] || null;
  const lastCompletedShidduch = completedShidduchim[0] || null;

  return {
    totalShidduchim: shidduchimData.filter((s) => s.status !== "draft").length,
    completedShidduchim: completedShidduchim.length,
    lastShidduchCreatedAt: lastShidduch?.created_at || null,
    lastShidduchCompletedAt: lastCompletedShidduch?.updated_at || null,
  };
}

function buildRow(
  user: User,
  entry: ShadchanListEntry,
  shidduchim: Awaited<ReturnType<typeof loadShidduchimStats>>,
  activity: ActivityStats,
): ShadchanAdminRow {
  const { applicationStatus, bio } = entry;
  const { firstName, lastName } = resolveDisplayName(user);
  return {
    id: user.id,
    firstName,
    lastName,
    email: user.email || null,
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at || null,
    applicationStatus,
    applicationStatusLabel: statusLabel(applicationStatus),
    ...shidduchim,
    lastActivityAt: latestOf(
      shidduchim.lastShidduchCreatedAt,
      user.last_sign_in_at || null,
    ),
    hasMissingOrShortDescription: isDescriptionMissingOrShort(
      applicationStatus,
      bio,
    ),
    isFrozen: entry.isFrozen,
    hasShadchanRole: hasRole(user, "shadchan"),
    hasProfileRow: entry.hasProfileRow,
    lastSeenAt: activity.lastSeenAt,
    activeSeconds: activity.activeSeconds,
  };
}

async function listShadchanEntries(
  adminClient: ReturnType<typeof createAdminClient>,
  usersById: Map<string, User>,
): Promise<{ entries: ShadchanListEntry[]; pendingCount: number }> {
  const { data: applications, error: appsError } = await adminClient
    .from("shadchanim_info")
    .select("user_id, application_status, submitted_at, bio, frozen_at")
    .order("submitted_at", { ascending: false, nullsFirst: false });

  if (appsError) {
    console.error("[admin-shadchanim] shadchanim_info:", appsError);
    throw new Error(appsError.message);
  }

  const pendingCount =
    applications?.filter((a) => a.application_status === "pending").length ?? 0;

  const allUsers = [...usersById.values()];
  const seen = new Set<string>();
  const entries: ShadchanListEntry[] = [];

  for (const app of applications ?? []) {
    seen.add(app.user_id);
    const user = usersById.get(app.user_id);
    const sortAt = app.submitted_at
      ? new Date(app.submitted_at).getTime()
      : user
        ? new Date(user.created_at).getTime()
        : 0;
    entries.push({
      userId: app.user_id,
      applicationStatus: app.application_status as ShadchanApplicationStatus,
      sortAt,
      bio: app.bio,
      isFrozen: Boolean(app.frozen_at),
      hasProfileRow: true,
    });
  }

  for (const user of allUsers) {
    if (!hasRole(user, "shadchan") || seen.has(user.id)) continue;
    entries.push({
      userId: user.id,
      applicationStatus: null,
      sortAt: new Date(user.created_at).getTime(),
      bio: null,
      isFrozen: false,
      hasProfileRow: false,
    });
    seen.add(user.id);
  }

  entries.sort((a, b) => b.sortAt - a.sortAt);
  return { entries, pendingCount };
}

async function resolveUser(
  adminClient: ReturnType<typeof createAdminClient>,
  usersById: Map<string, User>,
  userId: string,
): Promise<User | null> {
  const cached = usersById.get(userId);
  if (cached) return cached;
  const { data: fetched, error } =
    await adminClient.auth.admin.getUserById(userId);
  if (error || !fetched.user) {
    console.error(`[admin-shadchanim] missing user ${userId}:`, error);
    return null;
  }
  return fetched.user;
}

/** טקסט החיפוש של שדכן: שם, אימייל וטלפון (ספרות בלבד, כדי ש-050-1234 יימצא גם כ-0501234) */
function searchHaystack(user: User | undefined): string {
  if (!user) return "";
  const { firstName, lastName } = resolveDisplayName(user);
  const phone = (user.phone ?? "").replace(/\D/g, "");
  return [firstName, lastName, user.email, phone]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function filterBySearch(
  entries: ShadchanListEntry[],
  usersById: Map<string, User>,
  q: string | undefined,
): ShadchanListEntry[] {
  const terms = (q ?? "").trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return entries;
  return entries.filter((entry) => {
    const haystack = searchHaystack(usersById.get(entry.userId));
    return terms.every(
      (term) =>
        haystack.includes(term) ||
        (/^[\d-]+$/.test(term) && haystack.includes(term.replace(/\D/g, ""))),
    );
  });
}

/** Lightweight counts for page shell (header, buttons). */
export async function getShadchanimSummary(): Promise<{
  total: number;
  pendingCount: number;
}> {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("shadchanim_info")
    .select("user_id, application_status");

  if (error) {
    console.error("[admin-shadchanim] summary:", error);
    return { total: 0, pendingCount: 0 };
  }

  const rows = data ?? [];
  const pendingCount = rows.filter(
    (r) => r.application_status === "pending",
  ).length;
  const infoUserIds = new Set(rows.map((r) => r.user_id));
  const allUsers = await fetchAllAuthUsers(adminClient);
  const orphanCount = allUsers.filter(
    (u) => hasRole(u, "shadchan") && !infoUserIds.has(u.id),
  ).length;

  return { total: rows.length + orphanCount, pendingCount };
}

/**
 * Paginated shadchan list: shadchanim_info (all statuses) + role=shadchan without
 * application. Reject does not delete rows — only updates application_status.
 */
export async function getShadchanimList(
  query: AdminShadchanimQuery,
): Promise<AdminShadchanimListResult> {
  const adminClient = createAdminClient();
  const supabase = await createClient();

  const page = clamp(query.page, 1, 1_000_000);
  const perPage = clamp(query.perPage, 5, 100);

  const allUsers = await fetchAllAuthUsers(adminClient);
  const usersById = new Map(allUsers.map((u) => [u.id, u]));

  const { entries: allEntries, pendingCount } = await listShadchanEntries(
    adminClient,
    usersById,
  );
  const filtered = filterBySearch(allEntries, usersById, query.q);
  const activity = await loadActivityStats(
    adminClient,
    filtered.map((entry) => entry.userId),
  );
  const entries = sortEntries(filtered, activity, query.sort);
  const total = entries.length;
  const lastPage = Math.max(1, Math.ceil(total / perPage) || 1);
  const safePage = Math.min(page, lastPage);
  const start = (safePage - 1) * perPage;
  const pageEntries = entries.slice(start, start + perPage);

  const rows: ShadchanAdminRow[] = [];
  for (const entry of pageEntries) {
    const user = await resolveUser(adminClient, usersById, entry.userId);
    if (!user) continue;
    const shidduchim = await loadShidduchimStats(supabase, user.id);
    rows.push(
      buildRow(user, entry, shidduchim, activity.get(user.id) ?? NO_ACTIVITY),
    );
  }

  return {
    rows,
    total,
    page: safePage,
    perPage,
    lastPage,
    pendingCount,
  };
}
