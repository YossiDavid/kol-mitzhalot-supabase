import { AvailableDedicationTile } from "@/components/website/dedications/available-dedication-tile";
import { DedicationTile } from "@/components/website/dedications/dedication-tile";
import type {
  PublicDedication,
  SponsorKind,
} from "@/features/dedications/lib/dedication-model";

interface DedicationSlotProps {
  kind: SponsorKind;
  /** הקוביות שבתוקף לסוג הזה, כבר בסדר התצוגה */
  items: readonly PublicDedication[];
  donateHref: string;
  /** מחיר הרכישה, כשהוגדר */
  price?: number;
}

/**
 * משבצת אחת של פרנס. כמה הקדשות בתוקף לאותו סוג מוצגות כולן, זו מעל זו;
 * בלי אף אחת מוצגת הזמנה להקדיש.
 */
export function DedicationSlot({
  kind,
  items,
  donateHref,
  price,
}: DedicationSlotProps) {
  if (items.length === 0) {
    return (
      <AvailableDedicationTile
        kind={kind}
        donateHref={donateHref}
        price={price}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {items.map((item) => (
        <DedicationTile
          key={item.id}
          kind={kind}
          dedicationType={item.dedication_type}
          honoree={item.honoree}
          donorLine={item.donor_line}
          note={item.note}
          startsOn={item.starts_on}
          endsOn={item.ends_on}
        />
      ))}
    </div>
  );
}
