import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const TYPO_MSG =
  "Use design-system typography tokens only (text-display|heading|title|subtitle|body|body-sm|label|caption), semantic HTML (h1–h6, p, small), or prose-km. See docs/DESIGN.md §טיפוגרפיה.";

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      ".claude/**",
      ".agents/**",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/no-unused-expressions": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "react/no-unescaped-entities": "warn",
      "prefer-const": "warn",
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "Literal[value=/text-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl)(?:$|[\\s\"'`\\]])/]",
          message: TYPO_MSG,
        },
        {
          selector: "Literal[value=/text-\\[\\d/]",
          message: TYPO_MSG,
        },
        {
          selector:
            "TemplateElement[value.raw=/text-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl)(?:$|[\\s\"'`\\]])/]",
          message: TYPO_MSG,
        },
        {
          selector: "TemplateElement[value.raw=/text-\\[\\d/]",
          message: TYPO_MSG,
        },
        {
          selector:
            "Property[key.name='fontSize'], Property[key.value='fontSize']",
          message:
            "Do not set inline fontSize. Use design-system text-* tokens. See docs/DESIGN.md §טיפוגרפיה.",
        },
      ],
    },
  },
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
];

export default eslintConfig;
