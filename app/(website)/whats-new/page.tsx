import Link from "next/link";
import { Suspense } from "react";
import { WebCta } from "@/components/website/cta";
import { LogoSvg } from "@/components/website/logo-svg";
import { createClient } from "@/lib/supabase/server";

const TIME_FILTERS = [
  { label: "היום", value: "today" },
  { label: "השבוע", value: "week" },
  { label: "בחודש האחרון", value: "month" },
];

const CATEGORY_LABELS: Record<string, string> = {
  parents: "להורים",
  singles: "למיועדים",
  shadchanim: "לשדכנים",
  general: "כללי",
};

async function PeriodFilters({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { period: currentPeriod = "" } = await searchParams;
  return (
    <div className="flex flex-wrap gap-2">
      {TIME_FILTERS.map((f) => {
        const isActive = currentPeriod === f.value;
        return (
          <Link
            key={f.value}
            href={`/whats-new?period=${f.value}` as any}
            className="rounded-full px-4 py-1.5 text-[14px] font-semibold no-underline transition-colors"
            style={{
              background: isActive ? "#2b5a5c" : "#fff",
              color: isActive ? "#f4f8f7" : "#5c6a68",
              border: "1px solid #d9dee0",
            }}
          >
            {f.label}
          </Link>
        );
      })}
    </div>
  );
}

function ArticleCard({
  cat,
  date,
  read,
  title,
  excerpt,
}: {
  cat: string;
  date: string;
  read: string;
  title: string;
  excerpt: string;
}) {
  return (
    <Link
      href={"/knowledge" as any}
      className="flex flex-col overflow-hidden rounded-2xl border border-[#d9dee0] bg-white no-underline shadow-[0_1px_3px_rgba(20,40,40,.06)] transition-all hover:-translate-y-1 hover:shadow-[0_18px_40px_-18px_rgba(20,40,40,.28)]"
    >
      <div
        className="relative flex items-center justify-center"
        style={{
          aspectRatio: "16/10",
          background: "#e8eeed",
          backgroundImage: "repeating-linear-gradient(135deg,transparent 0 13px,rgba(43,90,92,.06) 13px 26px)",
          color: "#9fb0ad",
          fontFamily: "ui-monospace,Menlo,monospace",
          fontSize: 11.5,
        }}
      >
        [ תמונת נושא ]
        <span className="absolute right-[14px] top-[14px] rounded-full bg-[rgba(255,255,255,.94)] px-3 py-[5px] text-[12px] font-bold text-[#2b5a5c] shadow-[0_2px_6px_rgba(20,40,40,.12)]">
          {cat}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-[10px] p-[22px_24px]">
        <div className="flex items-center gap-2 text-[12.5px] text-[#8a9694]">
          <span>{date}</span>
          <span className="h-[3px] w-[3px] rounded-full bg-[#c3ccce]" />
          <span>{read}</span>
        </div>
        <h3 className="text-[17px] font-bold leading-[1.35] text-[#1b2523]" style={{ margin: 0 }}>{title}</h3>
        <p className="text-[14px] leading-[1.6] text-[#66716f]" style={{ margin: 0 }}>{excerpt}</p>
        <div className="mt-auto flex items-center justify-between border-t border-[#eef2f2] pt-4">
          <div className="flex items-center gap-[9px]">
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[rgba(43,90,92,.12)]">
              <LogoSvg size={15} className="text-[#2b5a5c]" />
            </span>
            <span className="text-[12.5px] font-semibold text-[#66716f]">מערכת קול מצהלות</span>
          </div>
          <span className="inline-flex items-center gap-[5px] text-[13.5px] font-bold text-[#2b5a5c]">
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

async function EngagementsSection({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { period } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("engagements")
    .select("id, groom_name, bride_name, groom_city, bride_city, shadchan_name")
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(10);

  if (period === "today") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    query = query.gte("created_at", today.toISOString());
  } else if (period === "week") {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    query = query.gte("created_at", weekAgo.toISOString());
  } else if (period === "month") {
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    query = query.gte("created_at", monthAgo.toISOString());
  }

  const { data: engagements } = await query;

  if (!engagements?.length) return null;

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
      {engagements.map((e) => (
        <div
          key={e.id}
          className="flex flex-col items-center justify-center rounded-[14px] border border-[#d9dee0] bg-white p-4 text-center"
          style={{ aspectRatio: "3/4" }}
        >
          <div className="mb-1 text-[13px] font-bold text-[#1b2523]">{e.groom_name}</div>
          <div className="mb-2 text-[11px] text-[#8a9694]">&</div>
          <div className="text-[13px] font-bold text-[#1b2523]">{e.bride_name}</div>
          {e.groom_city && (
            <div className="mt-3 text-[11px] text-[#8a9694]">{e.groom_city}</div>
          )}
        </div>
      ))}
    </div>
  );
}

async function ArticlesSection() {
  const supabase = await createClient();
  const { data: articles } = await supabase
    .from("articles")
    .select("id, slug, title, excerpt, category, read_time_minutes, published_at")
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(9);

  if (!articles?.length) return null;

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {articles.map((a) => (
        <ArticleCard
          key={a.id}
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

export default function WhatsNewPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  return (
    <>
      {/* Hero */}
      <section className="bg-[#ecf0f2]">
        <div className="mx-auto px-6 py-16 text-center" style={{ maxWidth: 1120 }}>
          <h1
            className="font-bold text-[#2b5a5c]"
            style={{ fontSize: "clamp(30px,3.8vw,46px)", marginBottom: 12, lineHeight: 1.1 }}
          >
            כל מה שחדש בתחום השידוכים בקהילתנו הק'
          </h1>
          <p className="text-[17px] text-[#5c6a68]">
            שידוכים שנסגרו, עדכונים חשובים, ומאמרים מרתקים.
          </p>
        </div>
      </section>

      {/* Engagements */}
      <section className="bg-[#e3e9eb]">
        <div className="mx-auto px-6 py-16" style={{ maxWidth: 1120 }}>
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <h2
              className="text-[#1b2523]"
              style={{ fontSize: "clamp(22px,2.8vw,30px)", fontWeight: 700, margin: 0, lineHeight: 1.2 }}
            >
              שידוכים שנסגרו למזל טוב
            </h2>
            <Suspense fallback={
              <div className="flex flex-wrap gap-2 opacity-50">
                {TIME_FILTERS.map((f) => (
                  <span key={f.value} className="rounded-full border border-[#d9dee0] bg-white px-4 py-1.5 text-[14px] font-semibold text-[#5c6a68]">{f.label}</span>
                ))}
              </div>
            }>
              <PeriodFilters searchParams={searchParams} />
            </Suspense>
          </div>

          <Suspense fallback={
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-[14px] bg-[#d9dee0]" style={{ aspectRatio: "3/4" }} />
              ))}
            </div>
          }>
            <EngagementsSection searchParams={searchParams} />
          </Suspense>

          <div className="mt-8 text-center">
            <Link
              href={"/contact#engagement" as any}
              className="inline-flex items-center gap-2 rounded-[8px] border border-[#cfd8d8] px-[18px] py-[10px] text-[14px] font-bold text-[#2b5a5c] no-underline transition-colors hover:bg-[#eef3f3]"
            >
              לפרסום מודעת מאורסים
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5" /><path d="m12 19-7-7 7-7" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* News Articles */}
      <section className="bg-[#ecf0f2]">
        <div className="mx-auto px-6 py-16" style={{ maxWidth: 1120 }}>
          <h2
            className="text-[#1b2523]"
            style={{ fontSize: "clamp(22px,2.8vw,30px)", fontWeight: 700, marginBottom: 32, lineHeight: 1.2 }}
          >
            חדש בתחום השידוכים
          </h2>
          <Suspense fallback={
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-[340px] animate-pulse rounded-2xl bg-[#d9dee0]" />
              ))}
            </div>
          }>
            <ArticlesSection />
          </Suspense>
        </div>
      </section>

      <WebCta />
    </>
  );
}
