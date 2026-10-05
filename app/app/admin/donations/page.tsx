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
import {
  DONATIONS_PAGE_SIZE,
  donationsHref,
  parseDonationsQuery,
  type DonationsQuery,
} from "@/features/admin/lib/donations-query";
import {
  loadDonationsReport,
  type DonationRow,
  type UnmatchedPaymentRow,
} from "@/features/admin/lib/donations-report";
import {
  AWAITING_CLEARANCE_LABEL,
  DONATION_STATUSES,
  DONATION_STATUS_BADGE_VARIANT,
  DONATION_STATUS_LABELS,
} from "@/features/donations/lib/status";

const FALLBACK_ROW_COUNT = 6;
const DESCRIPTION = "תרומות דרך נדרים פלוס, ומצב האישור של כל אחת";

// ההרשאה נאכפת בשתי שכבות שאינן תלויות בדף: app/app/admin/layout.tsx מפנה
// החוצה כל מי שאינו מנהל, ומדיניות ה-RLS על donations ו-donation_payments
// מחזירה שורות למנהל בלבד.

type DonationsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const FREQUENCY_LABELS: Record<DonationRow["frequency"], string> = {
  one_time: "חד־פעמית",
  monthly: "חודשית",
};

const KIND_LABELS: Record<string, string> = {
  transaction: "עסקה",
  keva_created: "הקמת הוראת קבע",
};

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("he-IL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  }).format(new Date(value));
}

const formatShekels = (amount: number) => `${amount.toLocaleString("he-IL")} ₪`;

const dash = (value: string | number | null) => value ?? "—";

const COLUMNS: DataTableColumn<DonationRow>[] = [
  {
    key: "date",
    header: "תאריך",
    size: "min",
    mobile: "title",
    cell: (row) => formatDateTime(row.createdAt),
  },
  {
    key: "amount",
    header: "סכום",
    size: "min",
    cell: (row) => formatShekels(row.amount),
  },
  {
    key: "frequency",
    header: "סוג",
    size: "min",
    cell: (row) => FREQUENCY_LABELS[row.frequency],
  },
  {
    key: "status",
    header: "סטטוס",
    size: "min",
    mobile: "aside",
    cell: (row) => (
      <Badge variant={DONATION_STATUS_BADGE_VARIANT[row.status]}>
        {row.status === "pending" && row.hasTemporaryPayment
          ? AWAITING_CLEARANCE_LABEL
          : DONATION_STATUS_LABELS[row.status]}
      </Badge>
    ),
  },
  {
    key: "dedication",
    header: "הקדשה",
    cell: (row) => dash(row.dedicationText),
  },
  {
    key: "donor",
    header: "תורם",
    cell: (row) => (
      <span className="flex flex-col">
        <span className="font-medium">{dash(row.donorName)}</span>
        {row.donorPhone && <bdi dir="ltr">{row.donorPhone}</bdi>}
        {row.donorEmail && <bdi dir="ltr">{row.donorEmail}</bdi>}
      </span>
    ),
  },
  {
    key: "transaction",
    header: "מזהה עסקה",
    cell: (row) => <bdi dir="ltr">{dash(row.providerTransactionId)}</bdi>,
  },
  {
    key: "charges",
    header: "חיובים",
    size: "min",
    cell: (row) => (row.frequency === "monthly" ? row.chargeCount : "—"),
  },
];

const UNMATCHED_COLUMNS: DataTableColumn<UnmatchedPaymentRow>[] = [
  {
    key: "received",
    header: "התקבל",
    size: "min",
    mobile: "title",
    cell: (row) => formatDateTime(row.receivedAt),
  },
  {
    key: "kind",
    header: "סוג",
    size: "min",
    cell: (row) => KIND_LABELS[row.kind] ?? row.kind,
  },
  {
    key: "amount",
    header: "סכום",
    size: "min",
    cell: (row) => (row.amount === null ? "—" : formatShekels(row.amount)),
  },
  { key: "client", header: "שם אצל הספק", cell: (row) => dash(row.clientName) },
  {
    key: "transaction",
    header: "מזהה עסקה / הוראת קבע",
    cell: (row) => (
      <bdi dir="ltr">
        {dash(row.providerTransactionId ?? row.providerKevaId)}
      </bdi>
    ),
  },
  {
    key: "reason",
    header: "סיבה",
    cell: (row) => <bdi dir="ltr">{dash(row.reason)}</bdi>,
  },
];

function BackToAdmin() {
  return (
    <Button asChild variant="outline">
      <Link href="/app/admin">חזרה לדף הבית</Link>
    </Button>
  );
}

function StatusFilter({ query }: { query: DonationsQuery }) {
  const options = [null, ...DONATION_STATUSES] as const;
  return (
    <nav
      aria-label="סינון לפי סטטוס"
      className="flex flex-wrap gap-2"
      data-testid="donations-filters"
    >
      {options.map((status) => (
        <Button
          key={status ?? "all"}
          asChild
          size="sm"
          variant={query.status === status ? "default" : "outline"}
        >
          <Link href={donationsHref({ status: status ?? undefined }) as Route}>
            {status ? DONATION_STATUS_LABELS[status] : "הכול"}
          </Link>
        </Button>
      ))}
    </nav>
  );
}

function Pager({
  query,
  lastPage,
}: {
  query: DonationsQuery;
  lastPage: number;
}) {
  if (lastPage <= 1) return null;
  const hrefFor = (page: number) => donationsHref({ ...query, page }) as Route;
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

function UnmatchedSection({ rows }: { rows: UnmatchedPaymentRow[] }) {
  return (
    <section className="flex flex-col gap-3" data-testid="donations-unmatched">
      <h2 className="text-subtitle font-bold">תשלומים שלא הותאמו</h2>
      <p className="text-body-sm text-muted-foreground">
        עדכונים מהספק שלא נקשרו לתרומה, או שהסכום/המטבע שלהם לא תאמו. כדאי לבדוק
        אותם מול הספק.
      </p>
      {rows.length === 0 ? (
        <p className="text-body-sm text-muted-foreground">אין תשלומים כאלה.</p>
      ) : (
        <DataTable
          caption="תשלומים שלא הותאמו"
          breakpoint="xl"
          columns={UNMATCHED_COLUMNS}
          rows={rows}
          getRowKey={(row) => row.id}
        />
      )}
    </section>
  );
}

async function DonationsContent({ searchParams }: DonationsPageProps) {
  noStore();
  const query = parseDonationsQuery(await searchParams);

  let report;
  try {
    report = await loadDonationsReport(query);
  } catch (err) {
    console.error("[admin/donations]", err);
    return (
      <Page>
        <PageHeader
          title="תרומות"
          description="אירעה שגיאה בטעינת התרומות"
          actions={<BackToAdmin />}
        />
        <div className="rounded-lg border border-destructive bg-destructive/10 p-6">
          <p className="text-body-sm">הטעינה נכשלה. נסו לרענן את הדף.</p>
        </div>
      </Page>
    );
  }

  const { rows, total, unmatched } = report;
  const lastPage = Math.max(1, Math.ceil(total / DONATIONS_PAGE_SIZE));
  const firstShown = (query.page - 1) * DONATIONS_PAGE_SIZE + 1;

  return (
    <Page>
      <PageHeader
        title="תרומות"
        count={total}
        description={DESCRIPTION}
        actions={<BackToAdmin />}
      />
      <StatusFilter query={query} />
      {rows.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>לא נמצאו תרומות</EmptyTitle>
            <EmptyDescription>
              {query.status
                ? "אין תרומות בסטטוס הזה"
                : "תרומות יופיעו כאן כשהתורמים יתחילו תשלום"}
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
            caption="רשימת התרומות"
            breakpoint="xl"
            columns={COLUMNS}
            rows={rows}
            getRowKey={(row) => row.id}
          />
          <Pager query={query} lastPage={lastPage} />
        </div>
      )}
      <UnmatchedSection rows={unmatched} />
    </Page>
  );
}

function DonationsFallback() {
  return (
    <Page>
      <PageHeader
        title="תרומות"
        description={DESCRIPTION}
        actions={<BackToAdmin />}
      />
      <DataTableSkeleton
        breakpoint="xl"
        rows={FALLBACK_ROW_COUNT}
        columns={COLUMNS.length}
      />
    </Page>
  );
}

export default function DonationsPage(props: DonationsPageProps) {
  return (
    <Suspense fallback={<DonationsFallback />}>
      <DonationsContent {...props} />
    </Suspense>
  );
}
