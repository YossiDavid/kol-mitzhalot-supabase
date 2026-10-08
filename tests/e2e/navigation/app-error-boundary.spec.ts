/**
 * Callers: Playwright `chromium` project; הבדיקה אינה פותחת דפדפן.
 * app/app/error.tsx הוא גבול שגיאות של זמן ריצה, ואין דרך בטוחה לגרום לדף
 * אמיתי לזרוק שגיאה בבדיקה. לכן הרכיב מרונדר ישירות: מוודאים שהוא מציג הודעה
 * ידידותית, כפתור "נסו שוב" וקישור לעמוד הראשי. הלחיצה על retry והרישום
 * בקונסול אינם נבדקים כאן (דורשים DOM).
 */
import { expect, test } from "@playwright/test";

import {
  renderToHtml,
  installReactJsxRuntime,
} from "../helpers/render-component";

test.describe("גבול השגיאות של האפליקציה", () => {
  test("מציג הודעה בעברית, 'נסו שוב' וקישור חזרה לעמוד הראשי", async () => {
    // Arrange
    installReactJsxRuntime();
    const { default: AppError } = await import("../../../app/app/error");
    const error = Object.assign(new Error("boom"), { digest: "abc123" });

    // Act
    const html = renderToHtml(AppError, { error, retry: () => {} });

    // Assert
    expect(html).toContain("משהו השתבש");
    expect(html).toContain("נסו שוב");
    expect(html).toContain('href="/app"');
    expect(html).toContain("חזרה לעמוד הראשי");
    expect(html).not.toContain("boom");
  });
});
