import { DedicationSlot } from "@/components/website/dedications/dedication-slot";
import { MemorialGrid } from "@/components/website/dedications/memorial-grid";
import {
  type PublicDedication,
  type SponsorKind,
} from "@/features/dedications/lib/dedication-model";

interface DedicationTilesViewProps {
  /** הקוביות שבתוקף היום (כל הסוגים) */
  items: readonly PublicDedication[];
  /** יעד כפתורי "פנוי": טופס התרומה */
  donateHref: string;
}

function itemsOfKind(
  items: readonly PublicDedication[],
  kind: PublicDedication["kind"],
): PublicDedication[] {
  return items.filter((item) => item.kind === kind);
}

const SECTION_HEADING_ID = "dedication-tiles-heading";
const MEMORIALS_HEADING_ID = "dedication-memorials-heading";

/**
 * בלוק ההקדשות: שלוש קוביות פרנס מדורגות (חודש הגדולה, שבוע בינונית, יום
 * קטנה) ומתחתיהן רשת הנצחות, אם יש. בדסקטופ חודש ברוחב מלא ומתחתיה שבוע
 * ויום זו לצד זו ביישור תחתון; בנייד הן מוערמות מהגדולה לקטנה.
 */
export function DedicationTilesView({
  items,
  donateHref,
}: DedicationTilesViewProps) {
  const slot = (kind: SponsorKind) => (
    <DedicationSlot
      kind={kind}
      items={itemsOfKind(items, kind)}
      donateHref={donateHref}
    />
  );
  const memorials = itemsOfKind(items, "memorial");

  return (
    <section
      id="dedication-tiles"
      aria-labelledby={SECTION_HEADING_ID}
      className="scroll-mt-20 bg-background"
    >
      <div className="shell-site py-16 md:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2
            id={SECTION_HEADING_ID}
            className="text-display font-bold text-primary"
          >
            פרנסי היום, השבוע והחודש
          </h2>
          <p className="mt-4 text-body text-muted-foreground">
            קול מצהלות פתוחה לכל המשפחות ללא עלות, ופועלת בזכות תרומות. אפשר
            לפרנס יום, שבוע או חודש, ולהקדיש אותם לעילוי נשמת, לרפואה, לזכות או
            להצלחה.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-12">{slot("sponsor_month")}</div>
          <div className="lg:col-span-7">{slot("sponsor_week")}</div>
          <div className="lg:col-span-5">{slot("sponsor_day")}</div>
        </div>

        {memorials.length > 0 ? (
          <div className="mt-16">
            <h3
              id={MEMORIALS_HEADING_ID}
              className="mb-6 text-center text-title font-bold text-primary"
            >
              הנצחות באתר
            </h3>
            <MemorialGrid items={memorials} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
