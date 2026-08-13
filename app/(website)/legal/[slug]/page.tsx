import { cacheLife } from "next/cache";
import { createClient } from "@/lib/supabase/public";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createClient();
  const { data } = await supabase
    .from("system_content")
    .select("title")
    .eq("key", slug)
    .maybeSingle();

  return {
    title: data?.title || "תוכן משפטי",
    description: `${data?.title || "מידע משפטי"} - תנאי שימוש ומדיניות`,
  };
}

async function LegalContent({ slug }: { slug: string }) {
  "use cache";
  cacheLife("hours");

  const supabase = createClient();

  const { data, error } = await supabase
    .from("system_content")
    .select("title, content")
    .eq("key", slug)
    .maybeSingle();

  if (error) {
    console.error("Error fetching legal content:", error);
    return (
      <div className="py-12 text-center" dir="rtl">
        <p className="text-subtitle text-destructive">
          אירעה שגיאה בטעינת התוכן. אנא נסה שוב מאוחר יותר.
        </p>
      </div>
    );
  }

  if (!data) {
    notFound();
  }

  return (
    <article dir="rtl">
      <h1 className="mb-8">{data.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: data.content }} />
    </article>
  );
}

function LegalPageSkeleton() {
  return (
    <div className="shell-site py-16 md:py-20" dir="rtl">
      <div className="animate-pulse space-y-6">
        <div className="h-10 w-2/3 rounded bg-muted" />
        <div className="space-y-3">
          <div className="h-4 rounded bg-muted" />
          <div className="h-4 rounded bg-muted" />
          <div className="h-4 w-5/6 rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}

async function LegalPageContent({ params }: Props) {
  const { slug } = await params;
  return <LegalContent slug={slug} />;
}

export default function LegalPage({ params }: Props) {
  return (
    <Suspense fallback={<LegalPageSkeleton />}>
      <LegalPageContent params={params} />
    </Suspense>
  );
}
