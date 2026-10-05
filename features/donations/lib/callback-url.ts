/**
 * כתובת ה-CallBack שנשלחת לספק. הספק לא יכול להגיע ל-localhost או לכתובת לא
 * ציבורית, ולכן שם מחזירים null והלקוח משמיט את CallBack. טהור.
 */
export const NEDARIM_CALLBACK_PATH = "/api/v1/donations/nedarim-callback";

const LOCAL_HOST_SUFFIXES = [".local", ".localhost", ".internal"];
const IPV4_PATTERN = /^\d{1,3}(\.\d{1,3}){3}$/;

function isPublicHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host === "[::1]" || !host.includes(".")) {
    return false;
  }
  if (LOCAL_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) return false;
  // כתובת IP גולמית אינה דומיין ציבורי שאפשר להסתמך עליו
  return !IPV4_PATTERN.test(host);
}

/** מחזיר את כתובת ה-CallBack המלאה, או null כשה-origin אינו https ציבורי */
export function buildCallbackUrl(origin: string): string | null {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !isPublicHostname(url.hostname)) return null;
  return `${url.origin}${NEDARIM_CALLBACK_PATH}`;
}
