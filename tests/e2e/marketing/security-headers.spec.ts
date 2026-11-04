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

/** x-pathname מזויף בנתיב שמסתיים בסיומת תמונה לא מדלג על שער ההתחברות */
test.describe("x-pathname מזויף", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("גולש לא מחובר מופנה להתחברות", async ({ request }) => {
    // Act
    const response = await request.get("/app/shidduchim/x.png", {
      headers: {
        "x-pathname": "/app/students/00000000-0000-0000-0000-000000000000",
      },
      maxRedirects: 0,
    });

    // Assert
    expect(response.status()).toBe(307);
    expect(response.headers()["location"]).toContain("/auth/login");
  });
});
