import Link from "next/link";
import { Suspense } from "react";
import { WebCta } from "@/components/website/cta";
import { LogoSvg } from "@/components/website/logo-svg";

const TIME_FILTERS = [
  { label: "היום", value: "today" },
  { label: "השבוע", value: "week" },
  { label: "בחודש האחרון", value: "month" },
];

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

const PLACEHOLDER_ARTICLES = Array.from({ length: 9 }, (_, i) => ({
  id: i,
  cat: ["להורים", "כללי", "למיועדים", "לשדכנים"][i % 4],
  date: 'כ"ב אב תשפ"ו',
  read: `${4 + (i % 4)} דק׳ קריאה`,
  title: `מאמר ${i + 1} — כותרת לדוגמה`,
  excerpt: "תקציר קצר של המאמר שיסביר במה הוא עוסק ולמי הוא מיועד.",
}));

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

          <div className="grid grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-center rounded-[14px] border border-dashed border-[#c3ccce] bg-white font-mono text-[12px] text-[#a9b3b3]"
                style={{ aspectRatio: "3/4" }}
              >
                מודעת מאורסים {i + 1}
              </div>
            ))}
          </div>

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
          <div className="grid grid-cols-3 gap-6">
            {PLACEHOLDER_ARTICLES.map((article) => (
              <ArticleCard key={article.id} {...article} />
            ))}
          </div>
        </div>
      </section>

      <WebCta />
    </>
  );
}
