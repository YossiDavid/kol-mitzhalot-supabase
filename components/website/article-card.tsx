import Link from "next/link";
import { LogoSvg } from "@/components/website/logo-svg";
import { ArticleCover } from "@/components/website/product-previews";
import {
  ARTICLE_CATEGORY_LABELS,
  articleHref,
  formatArticleDate,
  formatReadTime,
  type ArticleSummary,
} from "@/lib/articles";

/** כרטיס מאמר ברשימת מרכז הידע ובהמשך הקריאה: עטיפה אחת שכולה קישור */
export function ArticleCard({ article }: { article: ArticleSummary }) {
  const categoryLabel =
    ARTICLE_CATEGORY_LABELS[article.category] ?? article.category;
  const date = formatArticleDate(article.published_at);

  return (
    <Link
      href={articleHref(article.slug) as never}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card no-underline transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      {article.cover_image_url ? (
        <div className="relative aspect-16/10 overflow-hidden bg-secondary">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={article.cover_image_url}
            alt=""
            loading="lazy"
            className="absolute inset-0 size-full object-cover"
          />
          <span className="absolute top-3 right-3 rounded-md bg-card px-3 py-1 text-caption font-bold text-primary">
            {categoryLabel}
          </span>
        </div>
      ) : (
        <ArticleCover category={article.category} badge={categoryLabel} />
      )}
      <div className="flex flex-1 flex-col gap-2.5 p-6">
        <div className="flex items-center gap-2 text-caption text-muted-foreground">
          {date ? <span>{date}</span> : null}
          {date ? (
            <span className="h-[3px] w-[3px] rounded-full bg-border" />
          ) : null}
          <span>{formatReadTime(article.read_time_minutes)}</span>
        </div>
        <h3 className="text-subtitle leading-[1.35] font-bold text-foreground group-hover:text-primary">
          {article.title}
        </h3>
        <p className="line-clamp-3 text-body-sm text-muted-foreground">
          {article.excerpt}
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
            לקריאה
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="transition-transform group-hover:-translate-x-0.5"
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
