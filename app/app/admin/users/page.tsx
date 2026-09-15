import { Page, PageHeader } from "@/components/layout";
import {
  DataTable,
  DataTableSkeleton,
  type DataTableColumn,
} from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
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
import { Skeleton } from "@/components/ui/skeleton";

// מספר שורות השלד בזמן הטעינה - מקרב את גובה הטבלה האמיתית ומונע קפיצת פריסה.
const FALLBACK_ROW_COUNT = 6;

type UsersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

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

const USER_COLUMNS: DataTableColumn<UserStatsRow>[] = [
  {
    key: "name",
    header: "שם מלא",
    size: "grow",
    mobile: "title",
    cell: (user) => formatFullName(user.firstName, user.lastName) || "לא זמין",
  },
  {
    key: "email",
    header: "אימייל",
    size: "grow",
    className: "wrap-anywhere",
    cell: (user) => user.email || "לא זמין",
  },
  {
    key: "roles",
    header: "תפקיד",
    size: "min",
    cell: (user) => user.roles.map(getRoleLabel).join(" · "),
  },
  {
    key: "children",
    header: "ילדים",
    size: "min",
    align: "center",
    cell: (user) => user.childrenCount,
  },
  {
    key: "offered",
    header: "שידוכים הוצעו",
    size: "min",
    align: "center",
    cell: (user) => user.shidduchimOfferedCount,
  },
  {
    key: "completed",
    header: "שידוכים נסגרו",
    size: "min",
    align: "center",
    cell: (user) => user.shidduchimCompletedCount,
  },
  {
    key: "joined",
    header: "תאריך הצטרפות",
    cell: (user) => formatDate(user.createdAt),
  },
  {
    key: "actions",
    header: <span className="sr-only">פעולות</span>,
    size: "min",
    mobile: "actions",
    cell: (user) => (
      <div className="flex items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={`/app/admin/users/${user.id}`}>צפייה</Link>
        </Button>
        {user.email && <ImpersonateButton userId={user.id} />}
      </div>
    ),
  },
];

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

async function UsersContent({ searchParams }: UsersPageProps) {
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
      <Page>
        <PageHeader
          title="שגיאה"
          description="אירעה שגיאה בטעינת המשתמשים"
          actions={
            <Button asChild>
              <Link href="/app/admin">חזרה לדף הבית</Link>
            </Button>
          }
        />
        <div className="rounded-lg border border-destructive bg-destructive/10 p-6">
          <h3 className="mb-2 text-subtitle font-semibold text-destructive">
            שגיאה בהגדרת האדמין
          </h3>
          {isServiceRoleKeyError ? (
            <div className="space-y-4">
              <p className="text-body-sm">
                המשתנה{" "}
                <code className="rounded bg-muted px-2 py-1">
                  SUPABASE_SERVICE_ROLE_KEY
                </code>{" "}
                לא מוגדר.
              </p>
              <div className="space-y-2 rounded-lg bg-muted p-4">
                <p className="font-semibold">הוראות התקנה:</p>
                <ol className="list-inside list-decimal space-y-1 text-body-sm">
                  <li>
                    פתח את קובץ{" "}
                    <code className="rounded bg-background px-1">
                      .env.local
                    </code>{" "}
                    בתיקיית הפרויקט
                  </li>
                  <li>
                    הוסף את השורה:{" "}
                    <code className="rounded bg-background px-1">
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
                    <code className="rounded bg-background px-1">
                      npm run dev
                    </code>
                    )
                  </li>
                </ol>
              </div>
              <p className="text-caption text-muted-foreground">
                ⚠️ ה-Service Role Key רגיש מאוד - אל תחלוק אותו או תעלה אותו
                ל-Git
              </p>
            </div>
          ) : (
            <p className="text-body-sm">{error.message}</p>
          )}
        </div>
      </Page>
    );
  }

  const q = query;

  return (
    <Page>
      <PageHeader
        title="כל המשתמשים"
        count={total}
        description="רשימת משתמשים עם עימוד, סינון ומיון"
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/app/admin">חזרה לדף הבית</Link>
            </Button>
            <Button asChild>
              <Link href="/app/admin/users/create">יצירת משתמש חדש</Link>
            </Button>
          </div>
        }
      />
      <Suspense fallback={<Skeleton className="h-24 rounded-lg" />}>
        <AdminUsersFilters />
      </Suspense>

      {total === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>לא נמצאו משתמשים לפי הסינון</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-body-sm text-muted-foreground">
            <span>
              מציג {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)}{" "}
              מתוך {total}
            </span>
            <span>
              עמוד {page} מתוך {lastPage}
            </span>
          </div>
          <DataTable
            className="pt-2"
            caption="רשימת המשתמשים"
            breakpoint="xl"
            columns={USER_COLUMNS}
            rows={stats}
            getRowKey={(user) => user.id}
          />

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
        </div>
      )}
    </Page>
  );
}

function UsersPageFallback() {
  return (
    <Page>
      <PageHeader
        title="כל המשתמשים"
        description="רשימת משתמשים עם עימוד, סינון ומיון"
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/app/admin">חזרה לדף הבית</Link>
            </Button>
            <Button asChild>
              <Link href="/app/admin/users/create">יצירת משתמש חדש</Link>
            </Button>
          </div>
        }
      />
      <Skeleton aria-hidden className="h-24 rounded-lg" />
      <DataTableSkeleton
        breakpoint="xl"
        rows={FALLBACK_ROW_COUNT}
        columns={8}
      />
    </Page>
  );
}

export default function UsersPage(props: UsersPageProps) {
  return (
    <Suspense fallback={<UsersPageFallback />}>
      <UsersContent {...props} />
    </Suspense>
  );
}
