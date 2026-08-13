import Link from "next/link";
import { Suspense } from "react";
import { WebCta } from "@/components/website/cta";
import { LogoSvg } from "@/components/website/logo-svg";
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

async function PeriodFilters({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { period: currentPeriod = "" } = await searchParams;
  return (
    <div className="flex flex-wrap gap-2">
      {TIME_FILTERS.map((f) => {
        const isActive = currentPeriod === f.value;
        return (
          <Link
            key={f.value}
            href={`/whats-new?period=${f.value}` as any}
            className={
              isActive
                ? "rounded-full border border-primary bg-primary px-4 py-1.5 text-body-sm font-semibold text-primary-foreground no-underline transition-colors"
                : "rounded-full border border-border bg-card px-4 py-1.5 text-body-sm font-semibold text-muted-foreground no-underline transition-colors"
            }
          >
            {f.label}
          </Link>
        );
      })}
    </div>
  );
}

function ArticleCard({
  slug,
  cat,
  date,
  read,
  title,
  excerpt,
}: {
  slug: string;
  cat: string;
  date: string;
  read: string;
  title: string;
  excerpt: string;
}) {
  return (
    <Link
      href={`/knowledge/${slug}` as any}
      className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card no-underline shadow-[0_1px_3px_rgba(20,40,40,.06)] transition-all hover:-translate-y-1 hover:shadow-[0_18px_40px_-18px_rgba(20,40,40,.28)]"
    >
      <div
        className="bg-primary-stripe relative flex aspect-[16/10] items-center justify-center font-mono text-caption text-muted-foreground"
      >
        [ תמונת נושא ]
        <span className="absolute right-[14px] top-[14px] rounded-full bg-card/94 px-3 py-[5px] text-caption font-bold text-primary shadow-[0_2px_6px_rgba(20,40,40,.12)]">
          {cat}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-[10px] p-[22px_24px]">
        <div className="flex items-center gap-2 text-caption text-muted-foreground">
          <span>{date}</span>
          <span className="h-[3px] w-[3px] rounded-full bg-border" />
          <span>{read}</span>
        </div>
        <h3 className="text-subtitle font-bold leading-[1.35] text-foreground" style={{ margin: 0 }}>{title}</h3>
        <p className="text-body-sm leading-[1.6] text-muted-foreground" style={{ margin: 0 }}>{excerpt}</p>
        <div className="mt-auto flex items-center justify-between border-t border-border pt-4">
          <div className="flex items-center gap-[9px]">
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-primary/12">
              <LogoSvg size={15} className="text-primary" />
            </span>
            <span className="text-caption font-semibold text-muted-foreground">מערכת קול מצהלות</span>
          </div>
          <span className="inline-flex items-center gap-[5px] text-body-sm font-bold text-primary">
            לקריאה{" "}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5" /><path d="m12 19-7-7 7-7" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  );
}

async function EngagementsSection({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
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
          className="flex flex-col items-center justify-center rounded-[14px] border border-border bg-card p-4 text-center"
          style={{ aspectRatio: "3/4" }}
        >
          <div className="mb-1 text-body-sm font-bold text-foreground">{e.groom_name}</div>
          <div className="mb-2 text-caption text-muted-foreground">&</div>
          <div className="text-body-sm font-bold text-foreground">{e.bride_name}</div>
          {e.groom_city && (
            <div className="mt-3 text-caption text-muted-foreground">{e.groom_city}</div>
          )}
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
          date={a.published_at ? new Date(a.published_at).toLocaleDateString("he-IL") : ""}
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
      {/* Hero */}
      <section className="bg-background">
        <div className="mx-auto px-6 py-16 text-center" style={{ maxWidth: 1120 }}>
          <h1
            className="font-bold text-primary text-display" style={{marginBottom: 12, lineHeight: 1.1}}
          >
            כל מה שחדש בתחום השידוכים בקהילתנו הק'
          </h1>
          <p className="text-subtitle text-muted-foreground">
            שידוכים שנסגרו, עדכונים חשובים, ומאמרים מרתקים.
          </p>
        </div>
      </section>

      {/* Engagements */}
      <section className="bg-muted">
        <div className="mx-auto px-6 py-16" style={{ maxWidth: 1120 }}>
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <h2
              className="text-foreground text-heading" style={{fontWeight: 700, margin: 0, lineHeight: 1.2}}
            >
              שידוכים שנסגרו למזל טוב
            </h2>
            <Suspense fallback={
              <div className="flex flex-wrap gap-2 opacity-50">
                {TIME_FILTERS.map((f) => (
                  <span key={f.value} className="rounded-full border border-border bg-card px-4 py-1.5 text-body-sm font-semibold text-muted-foreground">{f.label}</span>
                ))}
              </div>
            }>
              <PeriodFilters searchParams={searchParams} />
            </Suspense>
          </div>

          <Suspense fallback={
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-[14px] bg-border" style={{ aspectRatio: "3/4" }} />
              ))}
            </div>
          }>
            <EngagementsSection searchParams={searchParams} />
          </Suspense>

          <div className="mt-8 text-center">
            <Link
              href={"/contact#engagement" as any}
              className="inline-flex items-center gap-2 rounded-[8px] border border-border px-[18px] py-[10px] text-body-sm font-bold text-primary no-underline transition-colors hover:bg-muted"
            >
              לפרסום מודעת מאורסים
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5" /><path d="m12 19-7-7 7-7" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* News Articles */}
      <section className="bg-background">
        <div className="mx-auto px-6 py-16" style={{ maxWidth: 1120 }}>
          <h2
            className="text-foreground text-heading" style={{fontWeight: 700, marginBottom: 32, lineHeight: 1.2}}
          >
            חדש בתחום השידוכים
          </h2>
          <Suspense fallback={
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-[340px] animate-pulse rounded-2xl bg-border" />
              ))}
            </div>
          }>
            <ArticlesSection />
          </Suspense>
        </div>
      </section>

      <WebCta />
    </>
  );
}
