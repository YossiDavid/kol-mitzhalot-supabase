import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";
import { fetchAllAuthUsers } from "@/features/admin/lib/users";
import { resolveDisplayName } from "@/lib/user-display-name";
import type { AdminShadchanimQuery } from "@/features/admin/lib/shadchanim-query";

export type { AdminShadchanimQuery };

export type ShadchanApplicationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | null;

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
};

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
};

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
  applicationStatus: ShadchanApplicationStatus,
  shidduchim: Awaited<ReturnType<typeof loadShidduchimStats>>,
): ShadchanAdminRow {
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
  };
}

async function listShadchanEntries(
  adminClient: ReturnType<typeof createAdminClient>,
  usersById: Map<string, User>,
): Promise<{ entries: ShadchanListEntry[]; pendingCount: number }> {
  const { data: applications, error: appsError } = await adminClient
    .from("shadchanim_info")
    .select("user_id, application_status, submitted_at")
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
    });
  }

  for (const user of allUsers) {
    if (user.user_metadata?.role !== "shadchan" || seen.has(user.id)) continue;
    entries.push({
      userId: user.id,
      applicationStatus: null,
      sortAt: new Date(user.created_at).getTime(),
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
    (u) => u.user_metadata?.role === "shadchan" && !infoUserIds.has(u.id),
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

  const { entries, pendingCount } = await listShadchanEntries(
    adminClient,
    usersById,
  );
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
    rows.push(buildRow(user, entry.applicationStatus, shidduchim));
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
