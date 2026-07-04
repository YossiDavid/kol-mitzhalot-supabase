import Section from "@/components/layout/section";
import Box from "@/components/layout/box";
import { Button } from "@/components/ui/button";
import { WebCta } from "@/components/website/cta";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const TIME_FILTERS = [
  { label: "היום", value: "today" },
  { label: "השבוע", value: "week" },
  { label: "בחודש האחרון", value: "month" },
];

export default function WhatsNewPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <Section containerClassName="py-12">
        <h1 className="text-center">כל מה שחדש בתחום השידוכים בקהילתנו הק'</h1>
      </Section>

      {/* Engagements */}
      <Section className="bg-muted/40" containerClassName="py-16">
        <div className="space-y-8">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2>שידוכים שנסגרו למזל טוב</h2>
            <div className="flex gap-2">
              {TIME_FILTERS.map((f) => (
                <Link
                  key={f.value}
                  href={`/whats-new?period=${f.value}` as any}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm transition-colors",
                    "bg-card hover:bg-muted",
                  )}
                >
                  {f.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <Box
                key={i}
                className="flex aspect-[3/4] items-center justify-center text-center text-xs text-muted-foreground"
              >
                מודעת מאורסים
              </Box>
            ))}
          </div>

          <div className="text-center">
            <Button asChild variant="outline">
              <Link href={"/contact#engagement" as any} className="flex items-center gap-1">
                לפרסום מודעת מאורסים
                <ArrowLeft className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </Section>

      {/* News */}
      <Section containerClassName="py-16">
        <div className="space-y-8">
          <h2>חדש בתחום השידוכים</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <Box
                key={i}
                asChild
                className="flex cursor-pointer flex-col gap-3 p-6 transition-shadow hover:shadow-md"
              >
                <Link href={"/knowledge" as any}>
                  <div className="aspect-video rounded-lg bg-muted" />
                  <p className="font-semibold">כותרת עדכון {i + 1}</p>
                  <span className="flex items-center gap-1 text-sm text-primary">
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
