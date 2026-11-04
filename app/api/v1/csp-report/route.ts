import { NextResponse } from "next/server";

/**
 * דיווחי הפרה של ה-CSP (Content-Security-Policy-Report-Only, next.config.ts).
 * הדפדפן שולח אותם לבד, גם לגולש לא מחובר. נרשמים ללוג השרת בלבד, בצורה
 * מקוצרת: בלי query string (עלול להכיל טוקנים) ובלי שאר הגוף.
 */
const MAX_REPORT_BYTES = 8 * 1024;
const MAX_FIELD_LENGTH = 300;

type CspReport = Record<string, unknown>;

function field(report: CspReport, ...keys: string[]): string {
  for (const key of keys) {
    const value = report[key];
    if (typeof value === "string" && value) {
      return value.slice(0, MAX_FIELD_LENGTH);
    }
  }
  return "";
}

/** כתובת בלי query ו-hash; ערך שאינו כתובת (inline, eval) חוזר כמו שהוא */
function withoutQuery(value: string): string {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return value;
  }
}

/** report-uri שולח {"csp-report": {...}}; Reporting API שולח [{body: {...}}] */
function extractReports(payload: unknown): CspReport[] {
  if (Array.isArray(payload)) {
    return payload
      .map((entry) => (entry as { body?: unknown })?.body)
      .filter((body): body is CspReport => typeof body === "object" && !!body);
  }
  const report = (payload as { "csp-report"?: unknown })?.["csp-report"];
  return typeof report === "object" && report ? [report as CspReport] : [];
}

export async function POST(request: Request): Promise<NextResponse> {
  const text = await request.text().catch(() => "");
  if (!text || text.length > MAX_REPORT_BYTES) {
    return new NextResponse(null, { status: 204 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  for (const report of extractReports(payload)) {
    console.warn("[csp-report]", {
      directive: field(report, "violated-directive", "effectiveDirective"),
      blocked: withoutQuery(field(report, "blocked-uri", "blockedURL")),
      page: withoutQuery(field(report, "document-uri", "documentURL")),
      source: withoutQuery(field(report, "source-file", "sourceFile")),
    });
  }
  return new NextResponse(null, { status: 204 });
}
