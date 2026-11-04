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
      const reportOnly = headers["content-security-policy-report-only"];
      expect(reportOnly).toContain("default-src 'self'");
      expect(reportOnly).toContain("object-src 'none'");
      expect(reportOnly).toContain("report-uri /api/v1/csp-report");
    });
  }
});

/**
 * CSP במצב דיווח: הדפים הציבוריים לא מפרים את המדיניות. הפרה מופיעה בקונסול
 * כ-"[Report Only]"; בלעדיה אפשר להעביר את המדיניות לאכיפה.
 */
test.describe("CSP במצב דיווח", () => {
  const PAGES = ["/", "/donations", "/auth/login", "/knowledge"];

  for (const path of PAGES) {
    test(`${path}: בלי הפרות`, async ({ page }) => {
      // Arrange
      const violations: string[] = [];
      page.on("console", (message) => {
        if (message.text().includes("Content Security Policy")) {
          violations.push(message.text());
        }
      });

      // Act
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      // Assert
      expect(violations).toEqual([]);
    });
  }

  test("נתיב הדיווח מקבל דיווח ומחזיר 204", async ({ request }) => {
    // Act
    const response = await request.post("/api/v1/csp-report", {
      headers: { "content-type": "application/csp-report" },
      data: JSON.stringify({
        "csp-report": {
          "violated-directive": "script-src",
          "blocked-uri": "https://evil.example/x.js?token=secret",
          "document-uri": "https://kol-mitzhalot.org.il/app?x=1",
        },
      }),
    });

    // Assert
    expect(response.status()).toBe(204);
  });
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
