import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import type { Metadata } from "next";
import { ArticleCard } from "@/components/website/article-card";
import { WebCta } from "@/components/website/cta";
import { Button } from "@/components/ui/button";
import {
  ARTICLE_CATEGORY_LABELS,
  formatArticleDate,
  formatReadTime,
  getPublishedArticle,
  listRelatedArticles,
  sanitizeArticleHtml,
  type PublishedArticle,
} from "@/lib/articles";

type Props = {
  params: Promise<{ slug: string }>;
};

/**
 * עיצוב גוף המאמר (HTML מעורך הטקסט העשיר). המחלקות שהעורך שמר בתוכן
 * מוסרות בניקוי, ולכן כל העיצוב נקבע כאן, בכיוון לוגי (RTL).
 */
const ARTICLE_BODY_CLASS = [
  "text-body leading-[1.95] text-foreground",
  "[&_p]:my-5",
  "[&_h2]:mt-12 [&_h2]:mb-4 [&_h2]:text-title [&_h2]:font-bold [&_h2]:text-primary",
  "[&_h3]:mt-9 [&_h3]:mb-3 [&_h3]:text-subtitle [&_h3]:font-bold [&_h3]:text-foreground",
  "[&_h4]:mt-7 [&_h4]:mb-2 [&_h4]:text-body [&_h4]:font-bold",
  "[&_ul]:my-5 [&_ul]:list-disc [&_ul]:ps-7",
  "[&_ol]:my-5 [&_ol]:list-decimal [&_ol]:ps-7",
  "[&_li]:my-2 [&_li]:ps-1 [&_li::marker]:text-primary",
  "[&_blockquote]:my-8 [&_blockquote]:rounded-xl [&_blockquote]:border-s-4 [&_blockquote]:border-brand-gold [&_blockquote]:bg-muted [&_blockquote]:px-6 [&_blockquote]:py-4 [&_blockquote]:text-foreground/85",
  "[&_blockquote_p]:my-2",
  "[&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4",
  "[&_img]:my-8 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-xl",
  "[&_hr]:my-10 [&_hr]:border-border",
  "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-body-sm",
  "[&>*:first-child]:mt-0",
].join(" ");

/** תיאור מקוצר למטא-דאטה (פתיחת הדף ברשתות) */
const META_DESCRIPTION_MAX = 200;

/**
 * נתוני המאמר מגיעים מהקאש (use cache) והסלאג מהנתיב (runtime), ולכן המטא-דאטה
 * דינמית: DynamicMarker בעמוד מסמן את זה כמכוון, כנדרש תחת Cache Components.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;

  try {
    const article = await getPublishedArticle(slug);
    if (!article) return { title: "מאמר לא נמצא" };

    const description = article.excerpt.slice(0, META_DESCRIPTION_MAX);
    return {
      title: article.title,
      description,
      openGraph: {
        type: "article",
        title: article.title,
        description,
        publishedTime: article.published_at ?? undefined,
        images: article.cover_image_url ? [article.cover_image_url] : undefined,
      },
    };
  } catch {
    return { title: "מרכז הידע" };
  }
}

async function DynamicMarkerInner() {
  await connection();
  return null;
}

function DynamicMarker() {
  return (
    <Suspense>
      <DynamicMarkerInner />
    </Suspense>
  );
}

function BackToKnowledge() {
  return (
    <Button asChild variant="ghost" className="-ms-3 mb-8 text-primary">
      <Link href={"/knowledge" as never}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 12h14" />
          <path d="m12 5 7 7-7 7" />
        </svg>
        חזרה למרכז הידע
      </Link>
    </Button>
  );
}

function ArticleHeader({ article }: { article: PublishedArticle }) {
  const date = formatArticleDate(article.published_at);
  const category =
    ARTICLE_CATEGORY_LABELS[article.category] ?? article.category;

  return (
    <header className="mb-10 border-b border-border pb-10">
      <span className="inline-block rounded-md bg-primary-muted px-3 py-1 text-caption font-bold text-primary">
        {category}
      </span>
      <h1 className="mt-5 text-display leading-[1.15] font-extrabold text-balance text-primary">
        {article.title}
      </h1>
      {article.excerpt ? (
        <p className="mt-5 text-subtitle leading-[1.6] text-muted-foreground">
          {article.excerpt}
        </p>
      ) : null}
      <p className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted-foreground">
        <span className="font-semibold text-foreground/80">
          מערכת קול מצהלות
        </span>
        {date ? (
          <>
            <span
              aria-hidden="true"
              className="h-[3px] w-[3px] rounded-full bg-border"
            />
            <time dateTime={article.published_at ?? undefined}>{date}</time>
          </>
        ) : null}
        <span
          aria-hidden="true"
          className="h-[3px] w-[3px] rounded-full bg-border"
        />
        <span>{formatReadTime(article.read_time_minutes)}</span>
      </p>
    </header>
  );
}

async function RelatedArticles({ article }: { article: PublishedArticle }) {
  const related = await listRelatedArticles(article);
  if (!related.length) return null;

  return (
    <section className="bg-secondary" aria-labelledby="related-articles">
      <div className="shell-site py-16 md:py-20">
        <h2
          id="related-articles"
          className="mb-8 text-heading font-bold text-primary"
        >
          להמשך קריאה
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {related.map((item) => (
            <ArticleCard key={item.id} article={item} />
          ))}
        </div>
      </div>
    </section>
  );
}

async function ArticleContent({ params }: Props) {
  const { slug } = await params;

  let article: PublishedArticle | null;
  try {
    article = await getPublishedArticle(slug);
  } catch {
    return (
      <div className="shell-site py-24 text-center" role="alert">
        <p className="text-subtitle font-bold text-destructive">
          אירעה שגיאה בטעינת המאמר
        </p>
        <p className="mt-2 text-body text-muted-foreground">
          אנא נסו שוב בעוד מספר דקות.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link href={"/knowledge" as never}>חזרה למרכז הידע</Link>
        </Button>
      </div>
    );
  }

  if (!article) notFound();

  return (
    <>
      <article className="shell-site py-12 md:py-16">
        <div className="mx-auto max-w-[44rem]">
          <BackToKnowledge />
          <ArticleHeader article={article} />
          {article.cover_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={article.cover_image_url}
              alt=""
              className="mb-10 aspect-16/9 w-full rounded-2xl border border-border object-cover"
            />
          ) : null}
          <div
            className={ARTICLE_BODY_CLASS}
            dangerouslySetInnerHTML={{
              __html: sanitizeArticleHtml(article.content),
            }}
          />
          <div className="mt-14 border-t border-border pt-8">
            <BackToKnowledge />
          </div>
        </div>
      </article>
      <Suspense fallback={null}>
        <RelatedArticles article={article} />
      </Suspense>
    </>
  );
}

function ArticleSkeleton() {
  return (
    <div className="shell-site py-12 md:py-16">
      <div className="mx-auto max-w-[44rem] animate-pulse space-y-6">
        <div className="h-4 w-40 rounded bg-muted" />
        <div className="h-12 w-3/4 rounded bg-muted" />
        <div className="space-y-3">
          <div className="h-4 rounded bg-muted" />
          <div className="h-4 rounded bg-muted" />
          <div className="h-4 w-5/6 rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}

export default function KnowledgeArticlePage({ params }: Props) {
  return (
    <>
      <Suspense fallback={<ArticleSkeleton />}>
        <ArticleContent params={params} />
      </Suspense>
      <DynamicMarker />
      <WebCta />
    </>
  );
}
