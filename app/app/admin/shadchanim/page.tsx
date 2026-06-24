import { DashboardSection } from "@/components/layout";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { Suspense } from "react";
import type { AdminShadchanimQuery } from "@/features/admin/lib/shadchanim";
import { getShadchanimSummary } from "@/features/admin/lib/shadchanim";
import {
  ShadchanimList,
  ShadchanimListFallback,
} from "@/features/admin/components/shadchanim-list";

function parseShadchanimQuery(
  raw: Record<string, string | string[] | undefined>,
): AdminShadchanimQuery {
  const g = (k: string) => {
    const v = raw[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const page = Math.max(1, parseInt(String(g("page") || "1"), 10) || 1);
  const perPageRaw = parseInt(String(g("perPage") || "25"), 10) || 25;
  const perPage = Math.min(100, Math.max(5, perPageRaw));
  return { page, perPage };
}

export default async function ShadchanimPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  noStore();
  const sp = await searchParams;
  const query = parseShadchanimQuery(sp);

  let total = 0;
  let pendingCount = 0;
  let error: Error | null = null;

  try {
    const summary = await getShadchanimSummary();
    total = summary.total;
    pendingCount = summary.pendingCount;
  } catch (err) {
    error = err instanceof Error ? err : new Error("Unknown error");
    console.error("Error in ShadchanimPage:", error);
  }

  if (error) {
    const isServiceRoleKeyError = error.message.includes(
      "SUPABASE_SERVICE_ROLE_KEY",
    );

    return (
      <div className="space-y-10 py-4">
        <DashboardSection
          title="שגיאה"
          subTitle="אירעה שגיאה בטעינת השדכנים"
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
              </div>
            ) : (
              <p className="text-sm">{error.message}</p>
            )}
          </div>
        </DashboardSection>
      </div>
    );
  }

  const listKey = `${query.page}-${query.perPage}`;

  return (
    <div className="space-y-10 py-4">
      <DashboardSection
        title="כל השדכנים"
        titleNumber={total}
        button={
          <div className="flex items-center gap-2">
            {pendingCount > 0 ? (
              <Button asChild variant="outline">
                <Link href="/app/admin/shadchanim/requests">
                  בקשות ממתינות ({pendingCount})
                </Link>
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link href="/app/admin/shadchanim/requests">בקשות ממתינות</Link>
              </Button>
            )}
            <Button asChild>
              <Link href="/app/admin">חזרה לדף הבית</Link>
            </Button>
          </div>
        }
      >
        <Suspense key={listKey} fallback={<ShadchanimListFallback />}>
          <ShadchanimList query={query} />
        </Suspense>
      </DashboardSection>
    </div>
  );
}
