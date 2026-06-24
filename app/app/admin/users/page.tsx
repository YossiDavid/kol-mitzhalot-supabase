import { DashboardSection } from "@/components/layout";
import { Box } from "@/components/layout";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { Route } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { Suspense } from "react";
import { ImpersonateButton } from "@/features/admin/components/impersonate-button";
import { AdminUsersFilters } from "@/features/admin/components/users-filters";
import { getRoleLabel } from "@/lib/user";
import {
  formatFullName,
  getAdminUsersList,
  type AdminUsersQuery,
  type UserStatsRow,
} from "@/features/admin/lib/users";

function formatDate(dateString: string | null): string {
  if (!dateString) return "לא זמין";
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("he-IL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function parseUsersQuery(
  raw: Record<string, string | string[] | undefined>,
): AdminUsersQuery {
  const g = (k: string) => {
    const v = raw[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const page = Math.max(1, parseInt(String(g("page") || "1"), 10) || 1);
  const perPageRaw = parseInt(String(g("perPage") || "25"), 10) || 25;
  const perPage = Math.min(100, Math.max(5, perPageRaw));
  const q = String(g("q") || "").trim();
  let roleRaw = String(g("role") || "");
  if (roleRaw === "all") roleRaw = "";
  const role = (
    ["", "admin", "shadchan", "user"].includes(roleRaw) ? roleRaw : ""
  ) as AdminUsersQuery["role"];
  const sortRaw = String(g("sort") || "joined");
  const sort = (
    ["joined", "email", "name", "role"].includes(sortRaw) ? sortRaw : "joined"
  ) as AdminUsersQuery["sort"];
  const orderRaw = String(g("order") || "desc");
  const order = (
    ["asc", "desc"].includes(orderRaw) ? orderRaw : "desc"
  ) as AdminUsersQuery["order"];

  return { page, perPage, q, role, sort, order };
}

function buildUsersHref(
  base: AdminUsersQuery,
  overrides: Partial<AdminUsersQuery>,
): string {
  const m = { ...base, ...overrides };
  const params = new URLSearchParams();
  if (m.page > 1) params.set("page", String(m.page));
  if (m.perPage !== 25) params.set("perPage", String(m.perPage));
  if (m.q) params.set("q", m.q);
  if (m.role) params.set("role", m.role);
  if (m.sort !== "joined") params.set("sort", m.sort);
  if (m.order !== "desc") params.set("order", m.order);
  const qs = params.toString();
  return qs ? `/app/admin/users?${qs}` : "/app/admin/users";
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  noStore();
  const sp = await searchParams;
  const query = parseUsersQuery(sp);

  let stats: UserStatsRow[] = [];
  let total = 0;
  let page = 1;
  let perPage = 25;
  let lastPage = 1;
  let error: Error | null = null;

  try {
    const result = await getAdminUsersList(query);
    stats = result.rows;
    total = result.total;
    page = result.page;
    perPage = result.perPage;
    lastPage = result.lastPage;
  } catch (err) {
    error = err instanceof Error ? err : new Error("Unknown error");
    console.error("Error in UsersPage:", error);
  }

  if (error) {
    const isServiceRoleKeyError = error.message.includes(
      "SUPABASE_SERVICE_ROLE_KEY",
    );

    return (
      <div className="space-y-10 py-4">
        <DashboardSection
          title="שגיאה"
          subTitle="אירעה שגיאה בטעינת המשתמשים"
          button={
            <Button asChild>
              <Link href="/app/admin">חזרה לדף הבית</Link>
            </Button>
          }
        >
          <div className="border-destructive bg-destructive/10 mt-6 rounded-lg border p-6">
            <h3 className="text-destructive mb-2 text-lg font-semibold">
              שגיאה בהגדרת האדמין
            </h3>
            {isServiceRoleKeyError ? (
              <div className="space-y-4">
                <p className="text-sm">
                  המשתנה{" "}
                  <code className="bg-muted rounded px-2 py-1">
                    SUPABASE_SERVICE_ROLE_KEY
                  </code>{" "}
                  לא מוגדר.
                </p>
                <div className="bg-muted space-y-2 rounded-lg p-4">
                  <p className="font-semibold">הוראות התקנה:</p>
                  <ol className="list-inside list-decimal space-y-1 text-sm">
                    <li>
                      פתח את קובץ{" "}
                      <code className="bg-background rounded px-1">
                        .env.local
                      </code>{" "}
                      בתיקיית הפרויקט
                    </li>
                    <li>
                      הוסף את השורה:{" "}
                      <code className="bg-background rounded px-1">
                        SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
                      </code>
                    </li>
                    <li>
                      מצא את ה-Service Role Key ב-{" "}
                      <a
                        href="https://supabase.com/dashboard/project/_/settings/api"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline"
                      >
                        Supabase Dashboard → Settings → API
                      </a>
                    </li>
                    <li>
                      הפעל מחדש את שרת הפיתוח (
                      <code className="bg-background rounded px-1">
                        npm run dev
                      </code>
                      )
                    </li>
                  </ol>
                </div>
                <p className="text-muted-foreground text-xs">
                  ⚠️ ה-Service Role Key רגיש מאוד - אל תחלוק אותו או תעלה אותו
                  ל-Git
                </p>
              </div>
            ) : (
              <p className="text-sm">{error.message}</p>
            )}
          </div>
        </DashboardSection>
      </div>
    );
  }

  const q = query;

  return (
    <div className="space-y-10 py-4">
      <DashboardSection
        title="כל המשתמשים"
        titleNumber={total}
        subTitle="רשימת משתמשים עם עימוד, סינון ומיון"
        button={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/app/admin">חזרה לדף הבית</Link>
            </Button>
            <Button asChild>
              <Link href="/app/admin/users/create">יצירת משתמש חדש</Link>
            </Button>
          </div>
        }
      >
        <Suspense fallback={<div className="bg-muted/30 mt-6 h-24 animate-pulse rounded-lg border" />}>
          <AdminUsersFilters />
        </Suspense>

        {total === 0 ? (
          <div className="text-muted-foreground py-10 text-center">
            לא נמצאו משתמשים לפי הסינון
          </div>
        ) : (
          <>
            <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 pt-6 text-sm">
              <span>
                מציג {(page - 1) * perPage + 1}–
                {Math.min(page * perPage, total)} מתוך {total}
              </span>
              <span>
                עמוד {page} מתוך {lastPage}
              </span>
            </div>
            <div className="grid grid-cols-[3fr_2fr_1fr_1fr_1fr_1fr_1fr_2fr] gap-4 pt-2">
              <div
                data-slot="table-header"
                className="col-span-full grid grid-cols-subgrid font-semibold"
              >
                <div>שם מלא</div>
                <div>אימייל</div>
                <div>תפקיד</div>
                <div>ילדים</div>
                <div>שידוכים הוצעו</div>
                <div>שידוכים נסגרו</div>
                <div>תאריך הצטרפות</div>
                <div>פעולות</div>
              </div>
              {stats.map((user) => (
                <Box
                  key={user.id}
                  className="col-span-full grid grid-cols-subgrid items-center"
                >
                  <div>
                    {formatFullName(user.firstName, user.lastName) || "לא זמין"}
                  </div>
                  <div className="text-sm">{user.email || "לא זמין"}</div>
                  <div>{getRoleLabel(user.role)}</div>
                  <div className="text-center">{user.childrenCount}</div>
                  <div className="text-center">
                    {user.shidduchimOfferedCount}
                  </div>
                  <div className="text-center">
                    {user.shidduchimCompletedCount}
                  </div>
                  <div className="text-sm">{formatDate(user.createdAt)}</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/app/admin/users/${user.id}`}>צפייה</Link>
                    </Button>
                    {user.email && <ImpersonateButton userId={user.id} />}
                  </div>
                </Box>
              ))}
            </div>

            {lastPage > 1 && (
              <div className="flex flex-wrap items-center justify-center gap-2 pt-8">
                {page <= 1 ? (
                  <Button variant="outline" size="sm" disabled type="button">
                    הקודם
                  </Button>
                ) : (
                  <Button asChild variant="outline" size="sm">
                    <Link href={buildUsersHref(q, { page: page - 1 }) as Route}>
                      הקודם
                    </Link>
                  </Button>
                )}
                {page >= lastPage ? (
                  <Button variant="outline" size="sm" disabled type="button">
                    הבא
                  </Button>
                ) : (
                  <Button asChild variant="outline" size="sm">
                    <Link href={buildUsersHref(q, { page: page + 1 }) as Route}>
                      הבא
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </DashboardSection>
    </div>
  );
}
