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

/**
 * כותרות אבטחה לכל התגובות. האתר לא מוטמע אצל אף אחד (ה-iframe של נדרים פלוס
 * מוטמע אצלנו, לא להפך), ולכן frame-ancestors 'none' חוסם clickjacking.
 * CSP מלא (script-src וכו') עוד לא מוגדר - דורש מעבר על GA, Supabase ונדרים.
 */
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
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
