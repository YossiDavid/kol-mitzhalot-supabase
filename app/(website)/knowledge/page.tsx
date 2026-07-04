import Section from "@/components/layout/section";
import Box from "@/components/layout/box";
import { WebCta } from "@/components/website/cta";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const CATEGORIES = [
  { label: "הכל", value: "" },
  { label: "להורים", value: "parents" },
  { label: "למיועדים", value: "singles" },
  { label: "לשדכנים", value: "shadchanim" },
];

const PLACEHOLDER_ARTICLES = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  title: `מאמר ${i + 1}`,
}));

export default function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
  return (
    <div className="flex flex-col">
      <Section containerClassName="py-16 md:py-24">
        <div className="space-y-10">
          {/* Header + tabs */}
          <div className="space-y-6 text-center">
            <div className="space-y-2">
              <h1>מרכז הידע של קול מצהלות</h1>
              <p className="text-muted-foreground">
                כל מה שחשוב לדעת על שידוכים, בירורים, פגישות, אירוסין ומה שביניהם.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {CATEGORIES.map((cat) => (
                <Link
                  key={cat.value}
                  href={(cat.value ? `/knowledge?cat=${cat.value}` : "/knowledge") as any}
                  className={cn(
                    "rounded-full border px-4 py-1.5 text-sm transition-colors",
                    "bg-card hover:bg-muted",
                  )}
                >
                  {cat.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Article grid */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {PLACEHOLDER_ARTICLES.map((article) => (
              <Box
                key={article.id}
                asChild
                className="flex cursor-pointer flex-col gap-3 p-6 transition-shadow hover:shadow-md"
              >
                <Link href={"/knowledge" as any}>
                  <div className="aspect-video rounded-lg bg-muted" />
                  <p className="font-semibold leading-snug">{article.title}</p>
                  <span className="mt-auto flex items-center gap-1 text-sm text-primary">
                    לקריאה
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </span>
                </Link>
              </Box>
            ))}
          </div>
        </div>
      </Section>

      <WebCta />
    </div>
  );
}
