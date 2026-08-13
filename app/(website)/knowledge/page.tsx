import Link from "next/link";
import { Suspense } from "react";
import { WebCta } from "@/components/website/cta";
import { LogoSvg } from "@/components/website/logo-svg";
import { ArticleCover } from "@/components/website/product-previews";
import { Button } from "@/components/ui/button";
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

async function CategoryFilters({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
  const { cat: currentCat = "" } = await searchParams;
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {CATEGORIES.map((cat) => {
        const isActive = currentCat === cat.value;
        return (
          <Button
            key={cat.value}
            asChild
            size="sm"
            variant={isActive ? "default" : "outline"}
          >
            <Link
              href={(cat.value ? `/knowledge?cat=${cat.value}` : "/knowledge") as any}
            >
              {cat.label}
            </Link>
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

async function ArticleGrid({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
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
        <p className="text-subtitle font-bold text-primary">
          עוד לא פורסמו מאמרים בקטגוריה זו
        </p>
        <p className="mt-2 text-body text-muted-foreground">
          בקרוב יתווספו מאמרים חדשים. חזרו שוב!
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link href={"/knowledge" as any}>לכל המאמרים</Link>
        </Button>
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

export default function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
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
            מרכז הידע של
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
              קול מצהלות
            </span>
          </h1>
          <p className="mt-8 max-w-2xl text-subtitle text-primary-foreground/85">
            כל מה שחשוב לדעת על שידוכים, בירורים, פגישות, אירוסין ומה שביניהם.
          </p>
        </div>
      </section>

      {/* Article grid */}
      <section className="bg-secondary">
        <div className="shell-site py-16 md:py-20">
          <div className="mb-10">
            <Suspense
              fallback={
                <div className="flex flex-wrap justify-center gap-2 opacity-50">
                  {CATEGORIES.map((cat) => (
                    <span
                      key={cat.value}
                      className="rounded-md border border-border px-4 py-1.5 text-body-sm font-semibold text-muted-foreground"
                    >
                      {cat.label}
                    </span>
                  ))}
                </div>
              }
            >
              <CategoryFilters searchParams={searchParams} />
            </Suspense>
          </div>
          <Suspense
            fallback={
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-[340px] animate-pulse rounded-2xl bg-border" />
                ))}
              </div>
            }
          >
            <ArticleGrid searchParams={searchParams} />
          </Suspense>
        </div>
      </section>

      <WebCta />
    </>
  );
}
