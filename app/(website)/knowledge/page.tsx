import Link from "next/link";
import { Suspense } from "react";
import { WebCta } from "@/components/website/cta";
import { LogoSvg } from "@/components/website/logo-svg";

const CATEGORIES = [
  { label: "הכל", value: "" },
  { label: "להורים", value: "parents" },
  { label: "למיועדים", value: "singles" },
  { label: "לשדכנים", value: "shadchanim" },
];

async function CategoryFilters({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const { cat: currentCat = "" } = await searchParams;
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {CATEGORIES.map((cat) => {
        const isActive = currentCat === cat.value;
        return (
          <Link
            key={cat.value}
            href={(cat.value ? `/knowledge?cat=${cat.value}` : "/knowledge") as any}
            className="rounded-full px-4 py-1.5 text-[14px] font-semibold no-underline transition-colors"
            style={{
              background: isActive ? "#2b5a5c" : "#fff",
              color: isActive ? "#f4f8f7" : "#5c6a68",
              border: "1px solid #d9dee0",
            }}
          >
            {cat.label}
          </Link>
        );
      })}
    </div>
  );
}

const PLACEHOLDER_ARTICLES = Array.from({ length: 12 }, (_, i) => ({
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

export default function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
  return (
    <>
      {/* Hero + filters */}
      <section className="bg-[#ecf0f2]">
        <div className="mx-auto px-6 py-[72px] text-center" style={{ maxWidth: 1120 }}>
          <h1
            className="font-bold text-[#2b5a5c]"
            style={{ fontSize: "clamp(30px,3.8vw,46px)", marginBottom: 12, lineHeight: 1.1 }}
          >
            מרכז הידע של קול מצהלות
          </h1>
          <p className="mb-8 text-[17px] text-[#5c6a68]">
            כל מה שחשוב לדעת על שידוכים, בירורים, פגישות, אירוסין ומה שביניהם.
          </p>
          <Suspense fallback={<div className="flex flex-wrap justify-center gap-2 opacity-50">
            {CATEGORIES.map((cat) => (
              <span key={cat.value} className="rounded-full border border-[#d9dee0] bg-white px-4 py-1.5 text-[14px] font-semibold text-[#5c6a68]">{cat.label}</span>
            ))}
          </div>}>
            <CategoryFilters searchParams={searchParams} />
          </Suspense>
        </div>
      </section>

      {/* Article grid */}
      <section className="bg-[#e3e9eb]">
        <div className="mx-auto px-6 py-16" style={{ maxWidth: 1120 }}>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
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
