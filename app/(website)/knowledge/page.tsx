import Link from "next/link";
import { Suspense } from "react";
import { WebCta } from "@/components/website/cta";
import type { Metadata } from "next";
import { ArticleCard } from "@/components/website/article-card";
import { Button } from "@/components/ui/button";
import { listPublishedArticles } from "@/lib/articles";

export const metadata: Metadata = {
  title: "מרכז הידע",
  description:
    "מאמרים ומדריכים על שידוכים, בירורים, פגישות ואירוסין: להורים, למיועדים ולשדכנים.",
  openGraph: {
    title: "מרכז הידע של קול מצהלות",
    description:
      "מאמרים ומדריכים על שידוכים, בירורים, פגישות ואירוסין: להורים, למיועדים ולשדכנים.",
  },
};

const CATEGORIES = [
  { label: "הכל", value: "" },
  { label: "להורים", value: "parents" },
  { label: "למיועדים", value: "singles" },
  { label: "לשדכנים", value: "shadchanim" },
  { label: "כללי", value: "general" },
];

async function CategoryFilters({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
  const { cat: currentCat = "" } = await searchParams;
  return (
    <nav
      aria-label="סינון מאמרים לפי קהל יעד"
      className="flex flex-wrap justify-center gap-2"
    >
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
              aria-current={isActive ? "page" : undefined}
              href={
                (cat.value
                  ? `/knowledge?cat=${cat.value}`
                  : "/knowledge") as never
              }
            >
              {cat.label}
            </Link>
          </Button>
        );
      })}
    </nav>
  );
}

async function ArticleGrid({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
  const { cat: currentCat = "" } = await searchParams;
  // קטגוריה לא מוכרת בכתובת מטופלת כ"הכל" ולא כרשימה ריקה מטעה
  const category = CATEGORIES.some((c) => c.value === currentCat)
    ? currentCat
    : "";

  let articles: Awaited<ReturnType<typeof listPublishedArticles>>;
  try {
    articles = await listPublishedArticles(category);
  } catch {
    return (
      <div className="py-20 text-center" role="alert">
        <p className="text-subtitle font-bold text-destructive">
          לא הצלחנו לטעון את המאמרים
        </p>
        <p className="mt-2 text-body text-muted-foreground">
          אנא רעננו את הדף או נסו שוב בעוד מספר דקות.
        </p>
      </div>
    );
  }

  if (!articles.length) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
        <p className="text-subtitle font-bold text-primary">
          {category
            ? "עוד לא פורסמו מאמרים בקטגוריה זו"
            : "מאמרים ראשונים בדרך"}
        </p>
        <p className="mt-2 text-body text-muted-foreground">
          בקרוב יתווספו מאמרים חדשים. חזרו שוב!
        </p>
        {category ? (
          <Button asChild variant="outline" className="mt-6">
            <Link href={"/knowledge" as never}>לכל המאמרים</Link>
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {articles.map((article) => (
        <ArticleCard key={article.id} article={article} />
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
        <div className="pointer-events-none absolute inset-0 bg-brand-gold-wash" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo_negative.svg"
          alt=""
          aria-hidden="true"
          width={720}
          height={720}
          className="pointer-events-none absolute -top-28 -left-24 opacity-[0.07] select-none"
        />

        <div className="relative shell-site flex flex-col items-center justify-center py-16 text-center md:py-24">
          <h1 className="text-hero max-w-5xl text-balance text-primary-foreground">
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
                  <div
                    key={i}
                    className="h-[340px] animate-pulse rounded-2xl bg-border"
                  />
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
