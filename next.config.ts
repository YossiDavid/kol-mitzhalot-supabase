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

const nextConfig: NextConfig = {
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
