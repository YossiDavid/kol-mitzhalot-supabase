import Link from "next/link";
import { Suspense } from "react";
import { WebCta } from "@/components/website/cta";
import { LogoSvg } from "@/components/website/logo-svg";
import { createClient } from "@/lib/supabase/server";

const CATEGORIES = [
  { label: "הכל", value: "" },
  { label: "להורים", value: "parents" },
  { label: "למיועדים", value: "singles" },
  { label: "לשדכנים", value: "shadchanim" },
];

const CATEGORY_LABELS: Record<string, string> = {
  parents: "להורים",
  singles: "למיועדים",
  shadchanim: "לשדכנים",
  general: "כללי",
};

async function CategoryFilters({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const { cat: currentCat = "" } = await searchParams;
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {CATEGORIES.map((cat) => {
        const isActive = currentCat === cat.value;
        return (
          <Link
            key={cat.value}
            href={(cat.value ? `/knowledge?cat=${cat.value}` : "/knowledge") as any}
            className={
              isActive
                ? "rounded-full border border-primary bg-primary px-4 py-1.5 text-body-sm font-semibold text-primary-foreground no-underline transition-colors"
                : "rounded-full border border-border bg-card px-4 py-1.5 text-body-sm font-semibold text-muted-foreground no-underline transition-colors"
            }
          >
            {cat.label}
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

async function ArticleGrid({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const { cat: currentCat = "" } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("articles")
    .select("id, slug, title, excerpt, category, read_time_minutes, published_at")
    .eq("is_published", true)
    .order("published_at", { ascending: false });

  if (currentCat) query = query.eq("category", currentCat);

  const { data: articles } = await query;

  if (!articles?.length) {
    return (
      <div className="py-20 text-center">
        <p className="text-subtitle font-bold text-primary">עוד לא פורסמו מאמרים בקטגוריה זו</p>
        <p className="mt-2 text-body text-muted-foreground">בקרוב יתווספו מאמרים חדשים. חזרו שוב!</p>
        <Link
          href={"/knowledge" as any}
          className="mt-6 inline-flex rounded-[8px] border border-border px-5 py-[10px] text-body-sm font-bold text-primary no-underline transition-colors hover:bg-muted"
        >
          לכל המאמרים
        </Link>
      </div>
    );
  }

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

export default function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
  return (
    <>
      {/* Hero + filters */}
      <section className="bg-background">
        <div className="mx-auto px-6 py-[72px] text-center" style={{ maxWidth: 1120 }}>
          <h1
            className="font-bold text-primary text-display" style={{marginBottom: 12, lineHeight: 1.1}}
          >
            מרכז הידע של קול מצהלות
          </h1>
          <p className="mb-8 text-subtitle text-muted-foreground">
            כל מה שחשוב לדעת על שידוכים, בירורים, פגישות, אירוסין ומה שביניהם.
          </p>
          <Suspense fallback={<div className="flex flex-wrap justify-center gap-2 opacity-50">
            {CATEGORIES.map((cat) => (
              <span key={cat.value} className="rounded-full border border-border bg-card px-4 py-1.5 text-body-sm font-semibold text-muted-foreground">{cat.label}</span>
            ))}
          </div>}>
            <CategoryFilters searchParams={searchParams} />
          </Suspense>
        </div>
      </section>

      {/* Article grid */}
      <section className="bg-muted">
        <div className="mx-auto px-6 py-16" style={{ maxWidth: 1120 }}>
          <Suspense fallback={
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-[340px] animate-pulse rounded-2xl bg-border" />
              ))}
            </div>
          }>
            <ArticleGrid searchParams={searchParams} />
          </Suspense>
        </div>
      </section>

      <WebCta />
    </>
  );
}
