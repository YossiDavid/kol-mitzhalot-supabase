/**
 * מראה הקוביות לפי סוג. הדירוג כאן הוא עיקר העיצוב: חודש הגדול והבולט,
 * שבוע בינוני, יום קטן, והנצחה אחידה וקטנה. הכול בטוקני העיצוב של האתר.
 */
import type { DedicationKind } from "@/features/dedications/lib/dedication-model";

export interface TileStyle {
  /** מעטפת הקובייה: רקע, ריפוד וגובה מינימלי */
  shell: string;
  label: string;
  headline: string;
  secondary: string;
  period: string;
}

const SECONDARY_ON_LIGHT = "text-foreground/75";

export const TILE_STYLES: Record<DedicationKind, TileStyle> = {
  sponsor_month: {
    shell:
      "relative isolate overflow-hidden bg-primary text-primary-foreground p-8 sm:p-10 lg:min-h-72 lg:justify-center lg:p-14",
    label: "text-brand-gold",
    headline: "text-heading font-extrabold text-primary-foreground",
    secondary: "text-primary-foreground/85",
    period: "text-primary-foreground/80",
  },
  sponsor_week: {
    shell:
      "border border-border border-s-4 border-s-brand-gold bg-card p-6 sm:p-8 lg:min-h-52 lg:justify-center",
    label: "text-primary",
    headline: "text-title font-bold text-foreground",
    secondary: SECONDARY_ON_LIGHT,
    period: SECONDARY_ON_LIGHT,
  },
  sponsor_day: {
    shell:
      "border border-border bg-card p-5 sm:p-6 lg:min-h-40 lg:justify-center",
    label: "text-primary",
    headline: "text-subtitle font-bold text-foreground",
    secondary: SECONDARY_ON_LIGHT,
    period: SECONDARY_ON_LIGHT,
  },
  memorial: {
    shell: "h-full border border-border bg-card p-5",
    label: "text-primary",
    headline: "text-body-sm font-bold text-foreground",
    secondary: SECONDARY_ON_LIGHT,
    period: SECONDARY_ON_LIGHT,
  },
};

/** מסגרת משותפת לכל קובייה: פינות מעט מעוגלות, בלי צל ובלי תנועה (תוכן הנצחה) */
export const TILE_BASE = "flex flex-col gap-3 rounded-2xl text-center";

/** קובייה פנויה: מסגרת מקווקווה במקום רקע מלא, באותו גודל של הסוג שלה */
export const AVAILABLE_SHELL: Record<
  Exclude<DedicationKind, "memorial">,
  string
> = {
  sponsor_month:
    "border-2 border-dashed border-primary/40 bg-transparent p-8 sm:p-10 lg:min-h-72 lg:justify-center lg:p-14",
  sponsor_week:
    "border-2 border-dashed border-primary/40 bg-transparent p-6 sm:p-8 lg:min-h-52 lg:justify-center",
  sponsor_day:
    "border-2 border-dashed border-primary/40 bg-transparent p-5 sm:p-6 lg:min-h-40 lg:justify-center",
};

export const AVAILABLE_HEADLINE: Record<
  Exclude<DedicationKind, "memorial">,
  string
> = {
  sponsor_month: "text-heading font-bold text-primary",
  sponsor_week: "text-title font-bold text-primary",
  sponsor_day: "text-subtitle font-bold text-primary",
};
