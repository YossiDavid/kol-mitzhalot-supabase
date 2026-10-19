import { Suspense } from "react";
import type { Route } from "next";
import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";

import { Page, PageHeader } from "@/components/layout";
import {
  DataTable,
  DataTableSkeleton,
  type DataTableColumn,
} from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  activityActionLabel,
  activityDetailsText,
  activityEntityHref,
} from "@/features/admin/lib/activity-labels";
import {
  loadActivityLog,
  type ActivityRow,
} from "@/features/admin/lib/activity-log";
import {
  ACTIVITY_ENTITY_LABELS,
  ACTIVITY_ENTITY_TYPES,
  ACTIVITY_LOG_PATH,
  ACTIVITY_PAGE_SIZE,
  activityLogHref,
  parseActivityLogQuery,
  type ActivityLogQuery,
} from "@/features/admin/lib/activity-log-query";
import { formatDateTimeIsrael, formatRelativeTime } from "@/lib/relative-time";

// ההרשאה נאכפת בשתי שכבות שאינן תלויות בדף: app/app/admin/layout.tsx מפנה
// החוצה כל מי שאינו מנהל, ומדיניות ה-RLS על activity_log מחזירה שורות למנהל
// בלבד.

const PAGE_TITLE = "יומן פעילות";
const PAGE_DESCRIPTION = "פעילות ושינויים אחרונים במערכת: מי עשה מה ומתי";
// מספר שורות השלד בזמן הטעינה - מקרב את גובה הטבלה האמיתית
const FALLBACK_ROW_COUNT = 8;

type ActivityPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function ActorCell({ row }: { row: ActivityRow }) {
  if (!row.actorId) {
    return <span className="text-muted-foreground">מערכת</span>;
  }
  return (
    <Link
      href={activityLogHref({ actor: row.actorId }) as Route}
      className="font-medium underline-offset-2 hover:underline"
      title="כל הפעולות של המבצע"
    >
      {row.actorName || "משתמש ללא שם"}
    </Link>
  );
}

function SubjectCell({ row }: { row: ActivityRow }) {
  const href = activityEntityHref(row.entityType, row.entityId);
  const label = row.summary || "-";
  if (!href) return label;
  return (
    <Link
      href={href as Route}
      className="underline-offset-2 hover:underline"
    >
      {label}
    </Link>
  );
}

const COLUMNS: DataTableColumn<ActivityRow>[] = [
  {
    key: "at",
    header: "מתי",
    size: "min",
    mobile: "title",
    cell: (row) => (
      <time dateTime={row.at} title={formatDateTimeIsrael(row.at)}>
        {formatRelativeTime(row.at)}
      </time>
    ),
  },
  {
    key: "action",
    header: "פעולה",
    size: "auto",
    cell: (row) => (
      <Badge variant="neutral" data-action={row.action}>
        {activityActionLabel(row.action)}
      </Badge>
    ),
  },
  {
    key: "subject",
    header: "על מה",
    size: "grow",
    cell: (row) => <SubjectCell row={row} />,
  },
  {
    key: "details",
    header: "פרטים",
    size: "grow",
    cell: (row) => activityDetailsText(row.entityType, row.details) ?? "-",
  },
  {
    key: "actor",
    header: "מי ביצע",
    size: "auto",
    cell: (row) => <ActorCell row={row} />,
  },
];

function Filters({ query }: { query: ActivityLogQuery }) {
  return (
    <form
      method="get"
      action={ACTIVITY_LOG_PATH}
      className="flex flex-wrap items-end gap-3"
      data-testid="activity-filters"
    >
      <div className="grid min-w-40 gap-2">
        <Label htmlFor="filter-entity">סוג</Label>
        <NativeSelect
          id="filter-entity"
          name="entity"
          defaultValue={query.entity}
        >
          <NativeSelectOption value="">הכול</NativeSelectOption>
          {ACTIVITY_ENTITY_TYPES.map((type) => (
            <NativeSelectOption key={type} value={type}>
              {ACTIVITY_ENTITY_LABELS[type]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="grid min-w-40 flex-1 gap-2">
        <Label htmlFor="filter-actor">מי ביצע</Label>
        <Input
          id="filter-actor"
          name="actor"
          defaultValue={query.actor}
          placeholder="שם או אימייל"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="filter-from">מתאריך</Label>
        <Input
          id="filter-from"
          name="from"
          type="date"
          defaultValue={query.from}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="filter-to">עד תאריך</Label>
        <Input id="filter-to" name="to" type="date" defaultValue={query.to} />
      </div>
      <Button type="submit">סינון</Button>
      <Button asChild variant="outline">
        <Link href={ACTIVITY_LOG_PATH as Route}>ניקוי</Link>
      </Button>
    </form>
  );
}

function Pager({
  query,
  lastPage,
}: {
  query: ActivityLogQuery;
  lastPage: number;
}) {
  if (lastPage <= 1) return null;
  const hrefFor = (page: number) => activityLogHref({ ...query, page }) as Route;
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 pt-8">
      {query.page <= 1 ? (
        <Button variant="outline" size="sm" disabled type="button">
          הקודם
        </Button>
      ) : (
        <Button asChild variant="outline" size="sm">
          <Link href={hrefFor(query.page - 1)}>הקודם</Link>
        </Button>
      )}
      {query.page >= lastPage ? (
        <Button variant="outline" size="sm" disabled type="button">
          הבא
        </Button>
      ) : (
        <Button asChild variant="outline" size="sm">
          <Link href={hrefFor(query.page + 1)}>הבא</Link>
        </Button>
      )}
    </div>
  );
}

async function ActivityContent({ searchParams }: ActivityPageProps) {
  noStore();
  const query = parseActivityLogQuery(await searchParams);

  let result;
  try {
    result = await loadActivityLog(query);
  } catch (err) {
    console.error("[admin/activity]", err);
    return (
      <Page>
        <PageHeader title={PAGE_TITLE} description="אירעה שגיאה בטעינת היומן" />
        <div className="rounded-lg border border-destructive bg-destructive/10 p-6">
          <p className="text-body-sm">טעינת היומן נכשלה. נסו לרענן את הדף.</p>
        </div>
      </Page>
    );
  }

  const { rows, total } = result;
  const lastPage = Math.max(1, Math.ceil(total / ACTIVITY_PAGE_SIZE));
  const firstShown = (query.page - 1) * ACTIVITY_PAGE_SIZE + 1;

  return (
    <Page>
      <PageHeader
        title={PAGE_TITLE}
        count={total}
        description={PAGE_DESCRIPTION}
      />
      <Filters query={query} />
      {rows.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>לא נמצאה פעילות לפי הסינון</EmptyTitle>
            <EmptyDescription>
              נסו להרחיב את טווח התאריכים או לנקות את הסינון
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-body-sm text-muted-foreground">
            <span>
              מציג {firstShown}–{firstShown + rows.length - 1} מתוך {total}
            </span>
            <span>
              עמוד {query.page} מתוך {lastPage}
            </span>
          </div>
          <DataTable
            className="pt-2"
            caption="יומן הפעילות"
            breakpoint="xl"
            columns={COLUMNS}
            rows={rows}
            getRowKey={(row) => row.id}
          />
          <Pager query={query} lastPage={lastPage} />
        </div>
      )}
    </Page>
  );
}

function ActivityFallback() {
  return (
    <Page>
      <PageHeader title={PAGE_TITLE} description={PAGE_DESCRIPTION} />
      <DataTableSkeleton
        breakpoint="xl"
        rows={FALLBACK_ROW_COUNT}
        columns={COLUMNS.length}
      />
    </Page>
  );
}

export default function ActivityLogPage(props: ActivityPageProps) {
  return (
    <Suspense fallback={<ActivityFallback />}>
      <ActivityContent {...props} />
    </Suspense>
  );
}
