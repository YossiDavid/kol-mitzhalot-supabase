import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";
import { getEffectiveRole, getRoleLabel } from "@/lib/user";
import {
  formatFullName,
  resolveDisplayName,
} from "@/lib/user-display-name";

export { formatFullName, resolveDisplayName };

export type UserStatsRow = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  role: string;
  createdAt: string;
  lastSignInAt: string | null;
  childrenCount: number;
  shidduchimOfferedCount: number;
  shidduchimCompletedCount: number;
};

export type AdminUsersQuery = {
  page: number;
  perPage: number;
  q: string;
  role: "" | "admin" | "shadchan" | "user";
  sort: "joined" | "email" | "name" | "role";
  order: "asc" | "desc";
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

async function loadProfilesMap(
  admin: ReturnType<typeof createAdminClient>,
  ids: string[],
): Promise<Map<string, { first_name: string | null; last_name: string | null }>> {
  const map = new Map<
    string,
    { first_name: string | null; last_name: string | null }
  >();
  if (ids.length === 0) return map;
  const { data, error } = await admin
    .from("user_profiles")
    .select("id, first_name, last_name")
    .in("id", ids);
  if (error) {
    console.warn("[admin-users] user_profiles:", error.message);
    return map;
  }
  for (const row of data ?? []) {
    map.set(row.id, {
      first_name: row.first_name,
      last_name: row.last_name,
    });
  }
  return map;
}

async function buildStatsForUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: User,
  profile: { first_name: string | null; last_name: string | null } | null,
): Promise<UserStatsRow> {
  const role = getEffectiveRole(user);
  const { firstName, lastName } = resolveDisplayName(user, profile);

  const { count: childrenCount } = await supabase
    .from("students")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  const { data: userStudents } = await supabase
    .from("students")
    .select("id")
    .eq("user_id", user.id);

  const studentIds = userStudents?.map((s) => s.id) || [];

  let shidduchimOfferedCount = 0;
  let shidduchimCompletedCount = 0;

  if (studentIds.length > 0) {
    const { data: groomShidduchim } = await supabase
      .from("shidduchim")
      .select("id, status")
      .in("groom_id", studentIds);

    const { data: brideShidduchim } = await supabase
      .from("shidduchim")
      .select("id, status")
      .in("bride_id", studentIds);

    const allShidduchim = [
      ...(groomShidduchim || []),
      ...(brideShidduchim || []),
    ];
    const uniqueShidduchim = allShidduchim.filter(
      (s, index, self) => index === self.findIndex((t) => t.id === s.id),
    );

    const offeredNonDraft = uniqueShidduchim.filter(
      (s) => s.status !== "draft",
    );
    shidduchimOfferedCount = offeredNonDraft.length;
    shidduchimCompletedCount = offeredNonDraft.filter(
      (s) => s.status === "completed",
    ).length;
  }

  return {
    id: user.id,
    firstName,
    lastName,
    email: user.email || null,
    role,
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at || null,
    childrenCount: childrenCount || 0,
    shidduchimOfferedCount,
    shidduchimCompletedCount,
  };
}

function userMatchesSearch(
  user: User,
  profile: { first_name: string | null; last_name: string | null } | null,
  q: string,
): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const email = (user.email || "").toLowerCase();
  const { firstName, lastName } = resolveDisplayName(user, profile);
  const hay = [email, firstName, lastName]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(needle);
}

function userMatchesRole(user: User, role: AdminUsersQuery["role"]): boolean {
  if (!role) return true;
  return getEffectiveRole(user) === role;
}

function sortUsers(
  users: User[],
  profiles: Map<
    string,
    { first_name: string | null; last_name: string | null }
  >,
  sort: AdminUsersQuery["sort"],
  order: AdminUsersQuery["order"],
): User[] {
  const dir = order === "asc" ? 1 : -1;
  const list = [...users];
  list.sort((a, b) => {
    const pa = profiles.get(a.id) ?? null;
    const pb = profiles.get(b.id) ?? null;
    if (sort === "joined") {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      return (ta - tb) * dir;
    }
    if (sort === "email") {
      const ea = (a.email || "").toLowerCase();
      const eb = (b.email || "").toLowerCase();
      return ea.localeCompare(eb, "he") * dir;
    }
    if (sort === "role") {
      const ra = getEffectiveRole(a);
      const rb = getEffectiveRole(b);
      const cmp = getRoleLabel(ra).localeCompare(getRoleLabel(rb), "he");
      return cmp * dir;
    }
    // name
    const na =
      `${resolveDisplayName(a, pa).firstName || ""} ${resolveDisplayName(a, pa).lastName || ""}`.trim();
    const nb =
      `${resolveDisplayName(b, pb).firstName || ""} ${resolveDisplayName(b, pb).lastName || ""}`.trim();
    return na.localeCompare(nb, "he") * dir;
  });
  return list;
}

export async function fetchAllAuthUsers(
  admin: ReturnType<typeof createAdminClient>,
): Promise<User[]> {
  const out: User[] = [];
  let page = 1;
  const perPage = 1000;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error("[admin-users] listUsers page", page, error);
      break;
    }
    const batch = data?.users ?? [];
    if (batch.length === 0) break;
    out.push(...batch);
    if (batch.length < perPage) break;
    page += 1;
  }
  return out;
}

function isFastPaginationPath(query: AdminUsersQuery): boolean {
  return (
    !query.q.trim() &&
    query.role === "" &&
    query.sort === "joined" &&
    query.order === "desc"
  );
}

export async function getAdminUsersList(
  query: AdminUsersQuery,
): Promise<{
  rows: UserStatsRow[];
  total: number;
  page: number;
  perPage: number;
  lastPage: number;
}> {
  const admin = createAdminClient();
  const supabase = await createClient();
  const page = clamp(query.page, 1, 1_000_000);
  const perPage = clamp(query.perPage, 5, 100);

  if (isFastPaginationPath(query)) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error || !data) {
      console.error("[admin-users] listUsers", error);
      return { rows: [], total: 0, page, perPage, lastPage: 1 };
    }
    const users = data.users ?? [];
    const total =
      typeof data.total === "number" ? data.total : users.length;
    const lastPage = Math.max(
      1,
      typeof data.lastPage === "number" && data.lastPage > 0
        ? data.lastPage
        : Math.ceil(total / perPage) || 1,
    );

    const ids = users.map((u) => u.id);
    const profiles = await loadProfilesMap(admin, ids);
    const rows: UserStatsRow[] = await Promise.all(
      users.map((u) =>
        buildStatsForUser(supabase, u, profiles.get(u.id) ?? null),
      ),
    );

    return { rows, total, page, perPage, lastPage };
  }

  const allUsers = await fetchAllAuthUsers(admin);
  const allIds = allUsers.map((u) => u.id);
  const profiles = await loadProfilesMap(admin, allIds);

  let filtered = allUsers.filter((u) => {
    if (!userMatchesRole(u, query.role)) return false;
    return userMatchesSearch(u, profiles.get(u.id) ?? null, query.q);
  });

  filtered = sortUsers(filtered, profiles, query.sort, query.order);

  const total = filtered.length;
  const lastPage = Math.max(1, Math.ceil(total / perPage) || 1);
  const safePage = Math.min(page, lastPage);
  const start = (safePage - 1) * perPage;
  const slice = filtered.slice(start, start + perPage);

  const rows: UserStatsRow[] = await Promise.all(
    slice.map((u) =>
      buildStatsForUser(supabase, u, profiles.get(u.id) ?? null),
    ),
  );

  return { rows, total, page: safePage, perPage, lastPage };
}
