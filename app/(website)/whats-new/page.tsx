import Link from "next/link";
import { Suspense } from "react";
import { WebCta } from "@/components/website/cta";
import { LogoSvg } from "@/components/website/logo-svg";
import { ArticleCover } from "@/components/website/product-previews";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

const TIME_FILTERS = [
  { label: "היום", value: "today" },
  { label: "השבוע", value: "week" },
  { label: "בחודש האחרון", value: "month" },
];

const CATEGORY_LABELS: Record<string, string> = {
  parents: "להורים",
  singles: "למיועדים",
  shadchanim: "לשדכנים",
  general: "כללי",
};

function HighlightSpan({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-block rounded-[11px]"
      style={{
        background: "var(--primary)",
        color: "var(--primary-foreground)",
        padding: "1px 14px 4px",
        transform: "rotate(-1.5deg)",
      }}
    >
      {children}
    </span>
  );
}

async function PeriodFilters({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: currentPeriod = "" } = await searchParams;
  return (
    <div className="flex flex-wrap gap-2">
      {TIME_FILTERS.map((f) => {
        const isActive = currentPeriod === f.value;
        return (
          <Button
            key={f.value}
            asChild
            size="sm"
            variant={isActive ? "default" : "outline"}
          >
            <Link href={`/whats-new?period=${f.value}` as any}>{f.label}</Link>
          </Button>
        );
      })}
    </div>
  );
}

function ArticleCard({
  slug,
  cat,
  category,
  date,
  read,
  title,
  excerpt,
}: {
  slug: string;
  cat: string;
  category: string;
  date: string;
  read: string;
  title: string;
  excerpt: string;
}) {
  return (
    <Link
      href={`/knowledge/${slug}` as any}
      className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card no-underline transition-transform hover:-translate-y-0.5"
    >
      <ArticleCover category={category} badge={cat} />
      <div className="flex flex-1 flex-col gap-2.5 p-6">
        <div className="flex items-center gap-2 text-caption text-muted-foreground">
          <span>{date}</span>
          <span className="h-[3px] w-[3px] rounded-full bg-border" />
          <span>{read}</span>
        </div>
        <h3 className="text-subtitle leading-[1.35] font-bold text-foreground">
          {title}
        </h3>
        <p className="text-body-sm text-muted-foreground">
          {excerpt}
        </p>
        <div className="mt-auto flex items-center justify-between border-t border-border pt-4">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-md bg-primary-muted">
              <LogoSvg size={15} className="text-primary" />
            </span>
            <span className="text-caption font-semibold text-muted-foreground">
              מערכת קול מצהלות
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-body-sm font-bold text-primary">
            לקריאה{" "}
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5" />
              <path d="m12 19-7-7 7-7" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  );
}

async function EngagementsSection({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("engagements")
    .select("id, groom_name, bride_name, groom_city, bride_city, shadchan_name")
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(10);

  if (period === "today") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    query = query.gte("created_at", today.toISOString());
  } else if (period === "week") {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    query = query.gte("created_at", weekAgo.toISOString());
  } else if (period === "month") {
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    query = query.gte("created_at", monthAgo.toISOString());
  }

  const { data: engagements } = await query;

  if (!engagements?.length) return null;

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
      {engagements.map((e) => (
        <div
          key={e.id}
          className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-4 text-center"
          style={{ aspectRatio: "3/4" }}
        >
          <div className="mb-1 text-body-sm font-bold text-foreground">
            {e.groom_name}
          </div>
          <div className="mb-2 text-caption text-muted-foreground">&</div>
          <div className="text-body-sm font-bold text-foreground">
            {e.bride_name}
          </div>
          {e.groom_city ? (
            <div className="mt-3 text-caption text-muted-foreground">
              {e.groom_city}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

async function ArticlesSection() {
  const supabase = await createClient();
  const { data: articles } = await supabase
    .from("articles")
    .select("id, slug, title, excerpt, category, read_time_minutes, published_at")
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(9);

  if (!articles?.length) return null;

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {articles.map((a) => (
        <ArticleCard
          key={a.id}
          slug={a.slug}
          cat={CATEGORY_LABELS[a.category] ?? a.category}
          category={a.category}
          date={
            a.published_at
              ? new Date(a.published_at).toLocaleDateString("he-IL")
              : ""
          }
          read={`${a.read_time_minutes} דק׳ קריאה`}
          title={a.title}
          excerpt={a.excerpt}
        />
      ))}
    </div>
  );
}

export default function WhatsNewPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  return (
    <>
      {/* ── 1. HERO ── */}
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="bg-brand-gold-wash pointer-events-none absolute inset-0" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo_negative.svg"
          alt=""
          aria-hidden="true"
          width={720}
          height={720}
          className="pointer-events-none absolute -top-28 -left-24 opacity-[0.07] select-none"
        />

        <div className="relative shell-site flex flex-col items-center justify-center py-24 text-center md:py-28">
          <h1 className="max-w-5xl text-hero text-balance text-primary-foreground">
            כל מה שחדש בתחום השידוכים
            <br />
            <span
              className="mt-3 inline-block rounded-xl"
              style={{
                background: "var(--brand-gold)",
                color: "var(--brand-gold-foreground)",
                padding: "1px 20px 6px",
                transform: "rotate(-1.5deg)",
              }}
            >
              בקהילתנו הק'
            </span>
          </h1>
          <p className="mt-8 max-w-2xl text-subtitle text-primary-foreground/85">
            שידוכים שנסגרו, עדכונים חשובים, ומאמרים מרתקים.
          </p>
        </div>
      </section>

      {/* Engagements */}
      <section className="bg-secondary">
        <div className="shell-site py-16 md:py-20">
          <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-display font-bold text-primary">
              שידוכים שנסגרו
              <br />
              <HighlightSpan>למזל טוב</HighlightSpan>
            </h2>
            <Suspense
              fallback={
                <div className="flex flex-wrap gap-2 opacity-50">
                  {TIME_FILTERS.map((f) => (
                    <span
                      key={f.value}
                      className="rounded-md border border-border px-4 py-1.5 text-body-sm font-semibold text-muted-foreground"
                    >
                      {f.label}
                    </span>
                  ))}
                </div>
              }
            >
              <PeriodFilters searchParams={searchParams} />
            </Suspense>
          </div>

          <Suspense
            fallback={
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="animate-pulse rounded-2xl bg-border"
                    style={{ aspectRatio: "3/4" }}
                  />
                ))}
              </div>
            }
          >
            <EngagementsSection searchParams={searchParams} />
          </Suspense>

          <div className="mt-10 text-center">
            <Button asChild variant="outline">
              <Link href={"/contact#engagement" as any}>
                לפרסום מודעת מאורסים
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* News Articles */}
      <section className="bg-background">
        <div className="shell-site py-16 md:py-20">
          <h2 className="mb-10 text-display font-bold text-primary">
            חדש בתחום השידוכים
          </h2>
          <Suspense
            fallback={
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-[340px] animate-pulse rounded-2xl bg-border" />
                ))}
              </div>
            }
          >
            <ArticlesSection />
          </Suspense>
        </div>
      </section>

      <WebCta />
    </>
  );
}
