import { escapeHtml } from "@/lib/email/escape-html";

/** אותו לוגו וצבעים כמו email-templates/sendgrid/shidduch-offer.html */
const LOGO_URL =
  "https://hnsugnkkujaochdwfyzb.supabase.co/storage/v1/object/public/logo/logo-kol-mitzhalot.png";
const BRAND_COLOR = "#254c49";
const PARAGRAPH_STYLE =
  "margin:0 0 12px;color:#4b5563;font-size:15px;line-height:1.7;";

export type EmailCta = { label: string; url: string };

export type EmailLayoutParams = {
  title: string;
  /** פסקאות טקסט גולמי - עוברות בריחה כאן */
  paragraphs: readonly string[];
  cta?: EmailCta;
  footerNote: string;
};

/**
 * מעטפת HTML אחידה (RTL) לכל מיילי המערכת. כל ערך שמגיע לכאן עובר
 * escapeHtml, כך שאין דרך להזריז HTML דרך שם, סיבה או הודעה חופשית.
 */
export function renderEmailLayout(params: EmailLayoutParams): string {
  const paragraphs = params.paragraphs
    .map(
      (paragraph) =>
        `<p style="${PARAGRAPH_STYLE}">${escapeHtml(paragraph).replace(/\r?\n/g, "<br />")}</p>`,
    )
    .join("\n              ");

  const cta = params.cta
    ? `<tr>
            <td style="padding:8px 32px 8px;text-align:center;">
              <a href="${escapeHtml(params.cta.url)}"
                 style="display:inline-block;background-color:${BRAND_COLOR};color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:10px;">
                ${escapeHtml(params.cta.label)}
              </a>
            </td>
          </tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(params.title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#ecf0f2;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#ecf0f2;">
    <tr>
      <td style="padding:40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:10px;border:1px solid #e5e7eb;">
          <tr>
            <td style="padding:32px 32px 20px;text-align:center;">
              <img src="${LOGO_URL}" alt="קול מצהלות" width="220" height="120" style="display:block;margin:0 auto;max-width:220px;height:auto;" />
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 8px;text-align:center;">
              <h1 style="margin:0;font-size:22px;font-weight:700;color:${BRAND_COLOR};">${escapeHtml(params.title)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 16px;text-align:right;">
              ${paragraphs}
            </td>
          </tr>
          ${cta}
          <tr>
            <td style="padding:24px 32px 28px;text-align:right;">
              <p style="margin:0;font-size:15px;color:#4b5563;line-height:1.7;">בברכה,<br /><strong>קול מצהלות</strong></p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 24px;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#6b7280;">${escapeHtml(params.footerNote)}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
