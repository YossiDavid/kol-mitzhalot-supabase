const MINUTE_SECONDS = 60;
const HOUR_SECONDS = 60 * MINUTE_SECONDS;

/** משך מצטבר בעברית מקוצרת: "פחות מדקה", "12 דק׳", "3 שע׳ 20 דק׳" */
export function formatActiveDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds < MINUTE_SECONDS) return seconds ? "פחות מדקה" : "—";
  const hours = Math.floor(seconds / HOUR_SECONDS);
  const minutes = Math.floor((seconds % HOUR_SECONDS) / MINUTE_SECONDS);
  if (hours === 0) return `${minutes} דק׳`;
  return minutes === 0 ? `${hours} שע׳` : `${hours} שע׳ ${minutes} דק׳`;
}
