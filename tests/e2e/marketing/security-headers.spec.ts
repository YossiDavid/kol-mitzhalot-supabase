import { expect, test } from "@playwright/test";

/** כותרות אבטחה (next.config.ts): חסימת הטמעה באתר זר ו-nosniff */
test.describe("כותרות אבטחה", () => {
  for (const path of ["/", "/app", "/auth/login"]) {
    test(`${path}: חוסם הטמעה ב-iframe`, async ({ request }) => {
      // Act
      const response = await request.get(path, { maxRedirects: 0 });
      const headers = response.headers();

      // Assert
      expect(headers["x-frame-options"]).toBe("DENY");
      expect(headers["content-security-policy"]).toContain(
        "frame-ancestors 'none'",
      );
      expect(headers["x-content-type-options"]).toBe("nosniff");
      expect(headers["referrer-policy"]).toBe(
        "strict-origin-when-cross-origin",
      );
    });
  }
});
