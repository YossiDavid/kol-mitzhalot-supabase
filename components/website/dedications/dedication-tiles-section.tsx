import { connection } from "next/server";

import { DedicationTilesView } from "@/components/website/dedications/dedication-tiles-view";
import { listCurrentDedications } from "@/features/dedications/lib/public-dedications";
import { israelDateOf } from "@/features/dedications/lib/israel-date";
import type { PublicDedication } from "@/features/dedications/lib/dedication-model";

/**
 * בלוק ההקדשות לדף הבית ולדף התרומות. לעטוף ב-<Suspense fallback={<DedicationTilesFallback />}>.
 *
 * "היום" נקבע בזמן הבקשה (connection() מסמן את הרכיב כדינמי; בלעדיו Cache
 * Components אוסר קריאת השעה), בשעון ישראל, והוא חלק ממפתח הקאש של השליפה.
 * כישלון בשליפה נרשם ללוג, והבלוק מציג את ההזמנות במקום להפיל את הדף.
 */
export async function DedicationTilesSection({
  donateHref,
}: {
  donateHref: string;
}) {
  await connection();
  const today = israelDateOf(new Date());

  let items: PublicDedication[] = [];
  try {
    items = await listCurrentDedications(today);
  } catch (error: unknown) {
    console.error("[dedications] הבלוק יוצג בלי הקדשות", error);
  }

  return <DedicationTilesView items={items} donateHref={donateHref} />;
}

/** שלד בזמן הטעינה, בגובה דומה כדי שהעמוד לא יקפוץ. לא מציג הזמנה: עוד לא ידוע אם המשבצת פנויה */
export function DedicationTilesFallback() {
  return (
    <div className="bg-background" aria-hidden="true">
      <div className="shell-site py-16 md:py-20">
        <div className="mx-auto h-24 max-w-2xl" />
        <div className="mt-12 grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-end">
          <div className="h-72 animate-pulse rounded-2xl bg-muted lg:col-span-12" />
          <div className="h-52 animate-pulse rounded-2xl bg-muted lg:col-span-7" />
          <div className="h-40 animate-pulse rounded-2xl bg-muted lg:col-span-5" />
        </div>
      </div>
    </div>
  );
}
