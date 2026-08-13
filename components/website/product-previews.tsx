import { LogoSvg } from "@/components/website/logo-svg";
import { cn } from "@/lib/utils";

function PreviewFrame({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full min-h-[32rem] flex-col overflow-hidden rounded-2xl border border-border bg-card",
        className,
      )}
      aria-hidden="true"
    >
      <div className="flex gap-1.5 border-b border-border bg-muted px-4 py-3">
        <span className="size-2.5 rounded-full bg-border" />
        <span className="size-2.5 rounded-full bg-border" />
        <span className="size-2.5 rounded-full bg-border" />
      </div>
      <div className="flex items-center gap-3 bg-primary px-4 py-3 text-primary-foreground">
        <LogoSvg size={22} className="text-brand-gold" />
        <span className="text-body-sm font-bold">{label}</span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col bg-secondary p-5 md:p-8">
        {children}
      </div>
    </div>
  );
}

function MiniStudentCard({
  name,
  meta,
  father,
  mother,
}: {
  name: string;
  meta: string;
  father: string;
  mother: string;
}) {
  return (
    <div className="flex flex-col rounded-md border border-dashed border-primary bg-card p-3">
      <p className="text-body-sm font-bold text-foreground">{name}</p>
      <p className="mt-0.5 text-caption leading-snug text-muted-foreground">
        {meta}
      </p>
      <div className="mt-3 rounded-lg bg-muted p-2 text-caption text-foreground/80">
        <p>
          <b>אב: </b>
          {father}
        </p>
        <p>
          <b>אם: </b>
          {mother}
        </p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <span className="inline-flex h-8 items-center justify-center rounded-md border border-primary px-2 text-center text-caption font-bold text-primary">
          צפיה בקו״ח
        </span>
        <span className="inline-flex h-8 items-center justify-center rounded-md border border-destructive/40 px-2 text-center text-caption font-bold text-destructive">
          הסרה
        </span>
      </div>
    </div>
  );
}

export function ParentsProductPreview({
  className,
}: {
  className?: string;
}) {
  return (
    <PreviewFrame label="הבית שלי" className={className}>
      <div className="flex h-full flex-col gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-body-sm font-bold text-foreground">
                כרטיס קו״ח
              </p>
              <p className="mt-1 text-caption text-muted-foreground">
                ירושלים · בחור ישיבה · 22
              </p>
            </div>
            <span className="rounded-full bg-primary-wash px-3 py-1 text-caption font-bold text-primary">
              בשידוכים
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-4/5 rounded-full bg-primary" />
          </div>
          <p className="mt-2 text-caption text-muted-foreground">
            הפרופיל מולא ומפורט לשדכנים מורשים
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-3 text-body-sm font-bold text-foreground">
            הצעות שהתקבלו
          </p>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2.5">
              <span className="text-caption font-semibold text-foreground">
                הצעה חדשה משדכן מורשה
              </span>
              <span className="text-caption font-bold text-brand-gold">
                ממתינה לתגובה
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2.5">
              <span className="text-caption font-semibold text-foreground">
                הצעה קודמת
              </span>
              <span className="text-caption font-bold text-primary">נענתה</span>
            </div>
          </div>
        </div>
      </div>
    </PreviewFrame>
  );
}

export function ShadchanimProductPreview({
  className,
}: {
  className?: string;
}) {
  return (
    <PreviewFrame label="לוח עבודה" className={className}>
      <div className="flex h-full flex-col gap-3">
        <div className="grid grid-cols-2 items-start gap-3">
          <MiniStudentCard
            name="יוסף כהן"
            meta="22 | ירושלים | 178 ס״מ | בחור ישיבה"
            father="ר' משה כהן הי״ו | כולל"
            mother="מרת רבקה | לבית שפירא | גננת"
          />
          <MiniStudentCard
            name="שרה לוי"
            meta="21 | בני ברק | 165 ס״מ | לומדת בסמינר"
            father="ר' יעקב לוי הי״ו | סוחר"
            mother="מרת לאה | לבית כהן | מורה"
          />
        </div>
        <div className="flex flex-wrap justify-center gap-2 pt-1">
          <span className="inline-flex h-10 items-center rounded-md bg-primary px-5 text-body-sm font-bold text-primary-foreground">
            שלח הצעה
          </span>
          <span className="inline-flex h-10 items-center rounded-md border border-primary px-4 text-body-sm font-bold text-primary">
            שמירה ללא שליחה
          </span>
        </div>
      </div>
    </PreviewFrame>
  );
}

function StarMark({ filled }: { filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={
        filled
          ? "size-4 fill-favorite text-favorite"
          : "size-4 fill-none text-muted-foreground"
      }
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M12 3.2 14.6 8.7l6 .9-4.3 4.2 1 6-5.3-2.8-5.3 2.8 1-6L3.4 9.6l6-.9Z" />
    </svg>
  );
}

const DIRECTORY_ROWS = [
  {
    favorite: true,
    name: "דוד גרין",
    meta: "רווק · ירושלים · 23 · 176 ס״מ",
  },
  {
    favorite: true,
    name: "רחל שטרן",
    meta: "רווקה · בני ברק · 21 · 164 ס״מ",
  },
  {
    favorite: false,
    name: "משה פריד",
    meta: "רווק · אשדוד · 24 · 180 ס״מ",
  },
  {
    favorite: false,
    name: "חיה וייס",
    meta: "רווקה · בית שמש · 22 · 162 ס״מ",
  },
];

export function DirectoryProductPreview({
  className,
}: {
  className?: string;
}) {
  return (
    <PreviewFrame label="מאגר המיועדים" className={className}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
          <span className="text-caption text-muted-foreground">חיפוש</span>
          <span className="h-4 w-px bg-border" />
          <span className="text-caption text-foreground">ירושלים · גיל 21–24</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {["בחור ישיבה", "סמינר", "מועדפים"].map((chip) => (
            <span
              key={chip}
              className="rounded-full bg-primary-wash px-2.5 py-1 text-caption font-bold text-primary"
            >
              {chip}
            </span>
          ))}
        </div>
        <p className="text-caption font-semibold text-muted-foreground">
          נמצאו 48 שמות
        </p>
        <div className="flex flex-col gap-2">
          {DIRECTORY_ROWS.map((row) => (
            <div
              key={row.name}
              className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2.5"
            >
              <StarMark filled={row.favorite} />
              <div className="min-w-0 flex-1">
                <p className="text-body-sm font-bold text-foreground">
                  {row.name}
                </p>
                <p className="text-caption text-muted-foreground">{row.meta}</p>
              </div>
              <span className="hidden shrink-0 rounded-md border border-primary px-2 py-1 text-caption font-bold text-primary sm:inline-flex">
                כרטיס מלא
              </span>
            </div>
          ))}
        </div>
      </div>
    </PreviewFrame>
  );
}

function FilledField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <p className="text-caption text-muted-foreground">{label}</p>
      <p className="text-body-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

export function CvFillPreview({ className }: { className?: string }) {
  return (
    <PreviewFrame label="מילוי כרטיס קו״ח" className={className}>
      <div className="flex h-full flex-col gap-3">
        <div className="h-2 overflow-hidden rounded-md bg-muted">
          <div className="h-full w-4/5 rounded-md bg-primary" />
        </div>
        <p className="text-caption font-semibold text-muted-foreground">
          הפרופיל מולא ומפורט לשדכנים מורשים
        </p>
        <div className="grid grid-cols-2 gap-2">
          <FilledField label="עיר" value="ירושלים" />
          <FilledField label="גיל" value="22" />
          <FilledField label="ישיבה" value="בחור ישיבה" />
          <FilledField label="עיסוק" value="לומד בכולל" />
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-caption text-muted-foreground">פרטים משפחתיים</p>
          <p className="mt-1 text-body-sm text-foreground/80">
            אב: ר' משה כהן הי״ו · כולל
            <br />
            אם: מרת רבקה · לבית שפירא · גננת
          </p>
        </div>
      </div>
    </PreviewFrame>
  );
}

export function PrivacyPreview({ className }: { className?: string }) {
  return (
    <PreviewFrame label="פרטיות ותמונות" className={className}>
      <div className="flex h-full flex-col gap-3">
        <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
          <div className="flex size-16 items-center justify-center rounded-md bg-muted text-primary">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div>
            <p className="text-body-sm font-bold text-foreground">
              תמונות מוסתרות
            </p>
            <p className="mt-1 text-caption leading-snug text-muted-foreground">
              רק אתם מאשרים למי ומתי להראות
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-3 text-body-sm font-bold text-foreground">
            חשוף לשדכנים מורשים בלבד
          </p>
          {["שדכן מאושר · ירושלים", "שדכנית מאושרת · בני ברק"].map((row) => (
            <div
              key={row}
              className="flex items-center justify-between gap-3 border-t border-border py-2.5 first:border-t-0 first:pt-0"
            >
              <span className="text-caption font-semibold text-foreground">
                {row}
              </span>
              <span className="text-caption font-bold text-primary">אושר</span>
            </div>
          ))}
        </div>
      </div>
    </PreviewFrame>
  );
}

export function ProposalReplyPreview({ className }: { className?: string }) {
  return (
    <PreviewFrame label="תגובה להצעה" className={className}>
      <div className="flex h-full flex-col gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-caption text-muted-foreground">הצעה חדשה</p>
          <p className="mt-1 text-body-sm font-bold text-foreground">
            משדכן מורשה
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <span className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-2 text-center text-caption font-bold text-primary-foreground">
            להתקדם
          </span>
          <span className="inline-flex h-10 items-center justify-center rounded-md border border-primary px-2 text-center text-caption font-bold text-primary">
            לברר
          </span>
          <span className="inline-flex h-10 items-center justify-center rounded-md border border-destructive/40 px-2 text-center text-caption font-bold text-destructive">
            להוריד
          </span>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-caption text-muted-foreground">הערה לשדכן</p>
          <p className="mt-2 text-body-sm text-foreground/80">
            תודה על ההצעה, נשמח לברר עוד פרטים.
          </p>
        </div>
      </div>
    </PreviewFrame>
  );
}

export function PremiumListingPreview({ className }: { className?: string }) {
  return (
    <PreviewFrame label="מאגר המיועדים" className={className}>
      <div className="flex flex-col gap-2">
        <div className="rounded-xl border border-brand-gold bg-brand-gold-muted p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-body-sm font-bold text-foreground">דוד גרין</p>
            <span className="rounded-md bg-brand-gold px-2 py-1 text-caption font-bold text-brand-gold-foreground">
              פרימיום
            </span>
          </div>
          <p className="text-caption text-foreground/80">
            רווק · ירושלים · 23 · בולט ברשימה
          </p>
          <p className="mt-2 text-caption font-bold text-brand-gold-foreground">
            דמי שדכנות מוגדלים
          </p>
        </div>
        {DIRECTORY_ROWS.slice(1, 3).map((row) => (
          <div
            key={row.name}
            className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <p className="text-body-sm font-bold text-foreground">{row.name}</p>
              <p className="text-caption text-muted-foreground">{row.meta}</p>
            </div>
          </div>
        ))}
      </div>
    </PreviewFrame>
  );
}

export function ResumeDetailPreview({ className }: { className?: string }) {
  return (
    <PreviewFrame label="כרטיס קו״ח מלא" className={className}>
      <div className="flex h-full flex-col gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-body-sm font-bold text-foreground">יוסף כהן</p>
              <p className="mt-1 text-caption text-muted-foreground">
                22 | ירושלים | 178 ס״מ | בחור ישיבה
              </p>
            </div>
            <span className="rounded-md bg-primary-wash px-3 py-1 text-caption font-bold text-primary">
              4 הצעות
            </span>
          </div>
          <div className="rounded-lg bg-muted p-3 text-caption text-foreground/80">
            <p>
              <b>אב: </b>
              ר' משה כהן הי״ו | כולל
            </p>
            <p>
              <b>אם: </b>
              מרת רבקה | לבית שפירא | גננת
            </p>
            <p className="mt-2">
              <b>עיסוק: </b>
              לומד בכולל
            </p>
          </div>
        </div>
        <span className="inline-flex h-10 items-center justify-center rounded-md border border-primary px-4 text-body-sm font-bold text-primary">
          צפיה בקו״ח המלא
        </span>
      </div>
    </PreviewFrame>
  );
}

export function ProposalCheckPreview({ className }: { className?: string }) {
  return (
    <PreviewFrame label="לוח עבודה" className={className}>
      <div className="flex h-full flex-col gap-3">
        <div className="grid grid-cols-2 items-start gap-3">
          <MiniStudentCard
            name="יוסף כהן"
            meta="22 | ירושלים | בחור ישיבה"
            father="ר' משה כהן הי״ו | כולל"
            mother="מרת רבקה | גננת"
          />
          <MiniStudentCard
            name="שרה לוי"
            meta="21 | בני ברק | סמינר"
            father="ר' יעקב לוי הי״ו | סוחר"
            mother="מרת לאה | מורה"
          />
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-body-sm font-bold text-primary">
            בדיקה אוטומטית
          </p>
          <p className="mt-1 text-caption text-muted-foreground">
            ההצעה לא הוצעה בעבר
          </p>
        </div>
        <span className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-5 text-body-sm font-bold text-primary-foreground">
          שלח הצעה
        </span>
      </div>
    </PreviewFrame>
  );
}

export function ProposalTrackingPreview({ className }: { className?: string }) {
  const rows = [
    { names: "יוסף כהן · שרה לוי", status: "ממתינה לתגובה", tone: "gold" },
    { names: "דוד גרין · רחל שטרן", status: "שני הצדדים מעוניינים", tone: "primary" },
    { names: "משה פריד · חיה וייס", status: "הצד השני הוריד", tone: "muted" },
  ] as const;

  return (
    <PreviewFrame label="מעקב הצעות" className={className}>
      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <div
            key={row.names}
            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
          >
            <p className="text-caption font-semibold text-foreground">
              {row.names}
            </p>
            <span
              className={
                row.tone === "gold"
                  ? "text-caption font-bold text-brand-gold-foreground"
                  : row.tone === "primary"
                    ? "text-caption font-bold text-primary"
                    : "text-caption font-bold text-muted-foreground"
              }
            >
              {row.status}
            </span>
          </div>
        ))}
      </div>
    </PreviewFrame>
  );
}

export function ShadchanForumPreview({ className }: { className?: string }) {
  return (
    <PreviewFrame label="פורום שדכנים" className={className}>
      <div className="flex h-full flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-body-sm font-bold text-foreground">בירורים</p>
          <span className="rounded-md bg-primary-wash px-2 py-1 text-caption font-bold text-primary">
            פיקוח רוחני
          </span>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-body-sm font-bold text-foreground">
            איך לברר על משפחה שלא מוכרת לי?
          </p>
          <p className="mt-2 text-caption text-muted-foreground">
            אפשר לבקש מידע נוסף מכלל שדכני המערכת בלחיצה אחת.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-muted p-4">
          <p className="text-caption font-bold text-primary">תגובה</p>
          <p className="mt-1 text-caption text-foreground/80">
            שלחתי בקשה דרך המאגר וקיבלתי תשובות באותו יום.
          </p>
        </div>
      </div>
    </PreviewFrame>
  );
}

function CoverSlice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col justify-end gap-2 p-4">{children}</div>
  );
}

export function ArticleCover({
  category,
  badge,
}: {
  category: string;
  badge: string;
}) {
  const slice =
    category === "shadchanim" ? (
      <CoverSlice>
        <div className="rounded-md border border-border bg-card px-3 py-2">
          <p className="text-caption text-muted-foreground">מאגר המיועדים</p>
          <p className="text-body-sm font-bold text-foreground">נמצאו 48 שמות</p>
        </div>
        <div className="rounded-md border border-border bg-card px-3 py-2">
          <p className="text-body-sm font-bold text-foreground">דוד גרין</p>
          <p className="text-caption text-muted-foreground">
            רווק · ירושלים · 23
          </p>
        </div>
      </CoverSlice>
    ) : category === "parents" || category === "singles" ? (
      <CoverSlice>
        <div className="rounded-md border border-border bg-card px-3 py-2">
          <p className="text-body-sm font-bold text-foreground">כרטיס קו״ח</p>
          <p className="text-caption text-muted-foreground">
            ירושלים · בחור ישיבה · 22
          </p>
        </div>
        <div className="rounded-md border border-border bg-card px-3 py-2">
          <p className="text-caption font-semibold text-foreground">
            הצעה חדשה משדכן מורשה
          </p>
          <p className="text-caption font-bold text-primary">ממתינה לתגובה</p>
        </div>
      </CoverSlice>
    ) : (
      <CoverSlice>
        <div className="rounded-md border border-border bg-card px-3 py-2">
          <p className="text-body-sm font-bold text-foreground">קול מצהלות</p>
          <p className="text-caption text-muted-foreground">
            הארגון לקידום שידוכים בבעלזא
          </p>
        </div>
      </CoverSlice>
    );

  return (
    <div className="relative aspect-16/10 overflow-hidden bg-secondary">
      {slice}
      <span className="absolute top-3 right-3 rounded-md bg-card px-3 py-1 text-caption font-bold text-primary">
        {badge}
      </span>
    </div>
  );
}
