import path from "node:path";

import { createElement, type ComponentType } from "react";
import * as reactJsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * Playwright מהדר קובצי .tsx עם jsx-runtime משלו (בנוי לבדיקות רכיבים), שמחזיר
 * אובייקטים במקום אלמנטים של React, ולכן רכיב מהאפליקציה אינו ניתן לרינדור
 * כמות שהוא. כאן מחליפים אותו ב-runtime של React, פעם אחת.
 * חובה לקרוא לפונקציה לפני ייבוא (דינמי) של רכיבים מהאפליקציה.
 */
export function installReactJsxRuntime(): void {
  const playwrightRuntimePath = path.join(
    path.dirname(require.resolve("playwright")),
    "jsx-runtime",
  );
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const playwrightRuntime = require(playwrightRuntimePath) as Record<
    string,
    unknown
  >;
  Object.assign(playwrightRuntime, reactJsxRuntime);
}

/** מרנדר רכיב שרת/לקוח ללא hooks של דפדפן ל-HTML סטטי */
export function renderToHtml<Props extends object>(
  component: ComponentType<Props>,
  props: Props,
): string {
  return renderToStaticMarkup(
    createElement(unwrapDefault<ComponentType<Props>>(component), props),
  );
}

/**
 * ייבוא דינמי של מודול שהודר ל-CommonJS עשוי להחזיר את ה-default עטוף
 * פעם נוספת ({ default: component }); פותח עד לפונקציה.
 */
function unwrapDefault<T>(value: unknown): T {
  let current = value;
  while (
    typeof current === "object" &&
    current !== null &&
    "default" in current
  ) {
    current = (current as { default: unknown }).default;
  }
  return current as T;
}
