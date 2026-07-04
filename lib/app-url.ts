/**
 * Canonical app origin for server-side (emails, redirects, metadataBase).
 * - Vercel (prod/preview): https://${VERCEL_URL}
 * - Explicit: NEXT_PUBLIC_APP_URL (e.g. https://kol-mitzhalot.org.il)
 * - Local dev: http://localhost:3000 (when neither set)
 * - Fallback: https://kol-mitzhalot.org.il
 */
export function getAppOrigin(): string {
  // NEXT_PUBLIC_APP_URL wins — it is the explicit production domain override.
  // VERCEL_URL is the deployment-specific hostname (e.g. project-abc123.vercel.app)
  // and must NOT take priority over the custom domain.
  const app = process.env.NEXT_PUBLIC_APP_URL;
  if (app) return app.endsWith("/") ? app.slice(0, -1) : app;
  if (typeof process.env.VERCEL_URL === "string" && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  if (process.env.NODE_ENV === "development") return "http://localhost:3000";
  return "https://kol-mitzhalot.org.il";
}
