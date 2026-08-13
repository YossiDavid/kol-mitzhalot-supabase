import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Metadata } from "next";
import { WebCta } from "@/components/website/cta";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

const CATEGORY_LABELS: Record<string, string> = {
  parents: "להורים",
  singles: "למיועדים",
  shadchanim: "לשדכנים",
  general: "כללי",
};

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("articles")
    .select("title, excerpt")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  return {
    title: data?.title ?? "מאמר",
    description: data?.excerpt ?? undefined,
  };
}

async function ArticleContent({ slug }: { slug: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("articles")
    .select(
      "title, excerpt, content, category, read_time_minutes, published_at",
    )
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (error) {
    console.error("Error fetching article:", error);
    return (
      <div className="py-12 text-center" dir="rtl">
        <p className="text-subtitle text-destructive">
          אירעה שגיאה בטעינת המאמר. אנא נסו שוב מאוחר יותר.
        </p>
      </div>
    );
  }

  if (!data) {
    notFound();
  }

  const date = data.published_at
    ? new Date(data.published_at).toLocaleDateString("he-IL")
    : "";
  const cat = CATEGORY_LABELS[data.category] ?? data.category;

  return (
    <article className="shell-site py-16 md:py-20" dir="rtl">
      <div className="mx-auto max-w-3xl">
        <Button asChild variant="ghost" className="mb-8 px-0">
          <Link href={"/knowledge" as any}>← חזרה למרכז הידע</Link>
        </Button>
        <div className="mb-4 flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
          <span className="rounded-md bg-primary-muted px-3 py-1 font-bold text-primary">
            {cat}
          </span>
          {date ? <span>{date}</span> : null}
          <span className="h-[3px] w-[3px] rounded-full bg-border" />
          <span>{data.read_time_minutes} דק׳ קריאה</span>
        </div>
        <div className="prose-km">
          <h1>{data.title}</h1>
          {data.excerpt ? (
            <p className="text-subtitle text-muted-foreground">{data.excerpt}</p>
          ) : null}
          <div dangerouslySetInnerHTML={{ __html: data.content }} />
        </div>
      </div>
    </article>
  );
}

function ArticleSkeleton() {
  return (
    <div className="shell-site animate-pulse space-y-6 py-16 md:py-20">
      <div className="h-4 w-40 rounded bg-muted" />
      <div className="h-10 w-2/3 rounded bg-muted" />
      <div className="space-y-3">
        <div className="h-4 rounded bg-muted" />
        <div className="h-4 rounded bg-muted" />
        <div className="h-4 w-5/6 rounded bg-muted" />
      </div>
    </div>
  );
}

export default async function KnowledgeArticlePage({ params }: Props) {
  const { slug } = await params;
  return (
    <>
      <Suspense fallback={<ArticleSkeleton />}>
        <ArticleContent slug={slug} />
      </Suspense>
      <WebCta />
    </>
  );
}
