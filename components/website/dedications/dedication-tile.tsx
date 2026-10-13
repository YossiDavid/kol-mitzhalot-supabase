import {
  TILE_BASE,
  TILE_STYLES,
} from "@/components/website/dedications/dedication-tile-styles";
import {
  KIND_LABELS,
  dedicationHeadline,
  isSponsorKind,
  type DedicationKind,
} from "@/features/dedications/lib/dedication-model";
import { dedicationPeriodLabel } from "@/features/dedications/lib/dedication-period";
import { cn } from "@/lib/utils";

export interface DedicationTileProps {
  kind: DedicationKind;
  dedicationType: string | null;
  honoree: string;
  donorLine: string | null;
  note: string | null;
  startsOn: string;
  endsOn: string | null;
}

/**
 * קובייה אחת: תווית, טקסט ההקדשה, הערה, תורם ותקופה. משמשת גם באתר וגם
 * בתצוגה המקדימה בניהול, כך שמה שהמנהל רואה הוא מה שיוצג.
 * כל טקסט שהמנהל הזין מרונדר כטקסט (React מקדד), לעולם לא כ-HTML.
 * קורא מסך: article עם כותרת (פרנס) או תווית (הנצחה), הטקסט והתקופה.
 */
export function DedicationTile({
  kind,
  dedicationType,
  honoree,
  donorLine,
  note,
  startsOn,
  endsOn,
}: DedicationTileProps) {
  const style = TILE_STYLES[kind];
  const isSponsor = isSponsorKind(kind);
  const period = isSponsor ? dedicationPeriodLabel(startsOn, endsOn) : null;
  const labelClass = cn(
    "text-caption font-bold tracking-[0.08em]",
    style.label,
  );

  return (
    <article
      className={cn(TILE_BASE, style.shell)}
      data-kind={kind}
      data-testid={`dedication-tile-${kind}`}
    >
      {kind === "sponsor_month" ? (
        // זוהר זהב עדין כמו ב-hero של האתר; -z-10 בתוך isolate: מתחת לטקסט
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-brand-gold-wash"
          aria-hidden="true"
        />
      ) : null}
      {isSponsor ? (
        <h3 className={labelClass}>{KIND_LABELS[kind]}</h3>
      ) : (
        <p className={labelClass}>{KIND_LABELS[kind]}</p>
      )}
      <p
        className={cn("leading-snug text-balance break-words", style.headline)}
      >
        {dedicationHeadline(dedicationType, honoree)}
      </p>
      {note ? (
        <p
          className={cn(
            "text-body-sm text-pretty break-words",
            style.secondary,
          )}
        >
          {note}
        </p>
      ) : null}
      {donorLine ? (
        <p className={cn("text-caption break-words", style.secondary)}>
          {donorLine}
        </p>
      ) : null}
      {period ? (
        <p className={cn("mt-auto pt-1 text-caption", style.period)}>
          {period.hebrew}
          <span aria-hidden="true"> · </span>
          <span dir="ltr" className="inline-block">
            {period.gregorian}
          </span>
        </p>
      ) : null}
    </article>
  );
}
