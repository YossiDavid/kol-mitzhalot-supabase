import type { NextConfig } from "next";

const PRINCIPLE_ICON_SVG = /(?:^|\/)assets\/icons\/(?:signs|trust|prize)\.svg$/;

const svgrLoader = {
  loader: "@svgr/webpack",
  options: {
    icon: true,
    replaceAttrValues: {
      "#000000": "currentColor",
      "#000": "currentColor",
    },
    svgoConfig: {
      plugins: [
        {
          name: "preset-default",
          params: { overrides: { removeViewBox: false } },
        },
      ],
    },
  },
};

const SUPABASE_ORIGIN = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return "";
  }
})();
const SUPABASE_REALTIME_ORIGIN = SUPABASE_ORIGIN.replace(/^http/, "ws");
const NEDARIM_FRAME_ORIGIN = "https://www.matara.pro";
const GOOGLE_ANALYTICS_ORIGINS =
  "https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com";
const IS_DEV = process.env.NODE_ENV !== "production";

/**
 * CSP מלא במצב דיווח בלבד (Report-Only): הדפדפן לא חוסם, רק מדווח ל-
 * /api/v1/csp-report (ללוג השרת). אחרי תקופה בלי דיווחים לא צפויים מעבירים
 * לכותרת Content-Security-Policy. 'unsafe-inline' בסקריפטים: Next.js מזריק
 * סקריפטים inline, ו-nonce היה הופך כל דף לדינמי. 'unsafe-eval' רק בפיתוח.
 */
const CONTENT_SECURITY_POLICY_REPORT_ONLY = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${IS_DEV ? " 'unsafe-eval'" : ""} https://www.googletagmanager.com`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${SUPABASE_ORIGIN} ${GOOGLE_ANALYTICS_ORIGINS}`,
  "font-src 'self' data:",
  `connect-src 'self' ${SUPABASE_ORIGIN} ${SUPABASE_REALTIME_ORIGIN} ${GOOGLE_ANALYTICS_ORIGINS}`,
  `frame-src ${NEDARIM_FRAME_ORIGIN}`,
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "report-uri /api/v1/csp-report",
].join("; ");

/**
 * כותרות אבטחה לכל התגובות. האתר לא מוטמע אצל אף אחד (ה-iframe של נדרים פלוס
 * מוטמע אצלנו, לא להפך), ולכן frame-ancestors 'none' חוסם clickjacking.
 */
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  {
    key: "Content-Security-Policy-Report-Only",
    value: CONTENT_SECURITY_POLICY_REPORT_ONLY,
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  cacheComponents: true,
  typedRoutes: true,
  turbopack: {
    rules: {
      // Match by filename first; Next 16.0 globs with `/` are unreliable here.
      "*.svg": {
        condition: {
          all: [{ not: "foreign" }, { path: PRINCIPLE_ICON_SVG }],
        },
        loaders: [svgrLoader],
        as: "*.js",
      },
    },
  },
  webpack(config) {
    const fileLoaderRule = config.module.rules.find((rule: { test?: RegExp }) =>
      rule.test?.test?.(".svg"),
    );

    if (fileLoaderRule) {
      fileLoaderRule.exclude = PRINCIPLE_ICON_SVG;
    }

    config.module.rules.push({
      test: PRINCIPLE_ICON_SVG,
      use: [svgrLoader],
    });

    return config;
  },
};

export default nextConfig;
