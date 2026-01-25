/**
 * Canonical app origin for server-side (emails, redirects, metadataBase).
 * - Vercel (prod/preview): https://${VERCEL_URL}
 * - Explicit: NEXT_PUBLIC_APP_URL (e.g. https://kol-mitzhalot.org.il)
 * - Local dev: http://localhost:3000 (when neither set)
 * - Fallback: https://kol-mitzhalot.org.il
 */
export function getAppOrigin(): string {
  if (typeof process.env.VERCEL_URL === "string" && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  const app = process.env.NEXT_PUBLIC_APP_URL;
  if (app) return app.endsWith("/") ? app.slice(0, -1) : app;
  if (process.env.NODE_ENV === "development") return "http://localhost:3000";
  return "https://kol-mitzhalot.org.il";
}
