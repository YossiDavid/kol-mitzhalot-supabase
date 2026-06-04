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
        <p className="text-lg text-red-600">
          אירעה שגיאה בטעינת התוכן. אנא נסה שוב מאוחר יותר.
        </p>
      </div>
    );
  }

  if (!data) {
    notFound();
  }

  return (
    <article className="mx-auto max-w-4xl px-6 py-12" dir="rtl">
      <h1 className="mb-8 text-4xl font-bold text-gray-900 dark:text-gray-100">
        {data.title}
      </h1>
      <div
        // className="prose prose-lg prose-slate dark:prose-invert max-w-none
        // 	prose-headings:font-bold prose-headings:text-gray-900 dark:prose-headings:text-gray-100
        // 	prose-p:text-gray-700 dark:prose-p:text-gray-300
        // 	prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
        // 	prose-strong:text-gray-900 dark:prose-strong:text-gray-100
        // 	prose-ul:list-disc prose-ol:list-decimal
        // 	*:text-right"
        dangerouslySetInnerHTML={{ __html: data.content }}
      />
    </article>
  );
}

function LegalPageSkeleton() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12" dir="rtl">
      <div className="animate-pulse space-y-6">
        <div className="h-10 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="space-y-3">
          <div className="h-4 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-4 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-4 w-5/6 rounded bg-gray-200 dark:bg-gray-700" />
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
