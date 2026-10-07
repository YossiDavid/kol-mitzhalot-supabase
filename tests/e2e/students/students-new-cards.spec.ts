import { test, expect } from "@playwright/test";

import { createServiceClient, getTestUserId } from "../shidduchim/fixtures";

/**
 * סימון כרטיסים חדשים ברשימת המיועדים: תג "חדש היום" / "חדש השבוע" ליד
 * השם, סינון "חדשים" בשרת, וניקוי הסינון. הגבולות עצמם נבדקים בפונקציה
 * הטהורה (new-card-window.spec.ts); כאן רק החיבור לרשימה.
 */
const FIRST_NAME = "חדשות";
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const LOAD_TIMEOUT = 15_000;
const DESKTOP_VIEWPORT = { width: 1440, height: 900 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };

const admin = createServiceClient();
const token = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

type CardKey = "fresh" | "thisWeek" | "old";
const AGE_MS: Record<CardKey, number> = {
  fresh: 5 * 60 * 1000,
  thisWeek: 4 * DAY_MS,
  old: 30 * DAY_MS,
};
const LAST_NAME: Record<CardKey, string> = {
  fresh: `אחת${token}`,
  thisWeek: `בשבוע${token}`,
  old: `ישנה${token}`,
};
const CARD_KEYS = Object.keys(AGE_MS) as CardKey[];

let studentIds: string[] = [];

test.beforeAll(async () => {
  const userId = await getTestUserId(admin);
  const now = Date.now();
  const { data, error } = await admin
    .from("students")
    .insert(
      CARD_KEYS.map((key) => ({
        user_id: userId,
        first_name: FIRST_NAME,
        last_name: LAST_NAME[key],
        birth_date: "1999-01-01",
        gender: "male",
        personal_status: "single",
        country: "ישראל",
        city: "בני ברק",
        in_shidduchim: true,
        created_at: new Date(now - AGE_MS[key]).toISOString(),
      })),
    )
    .select("id");
  if (error || !data) {
    throw new Error(`יצירת כרטיסי הבדיקה נכשלה: ${error?.message}`);
  }
  studentIds = data.map((row) => row.id as string);
});

test.afterAll(async () => {
  if (studentIds.length > 0) {
    await admin.from("students").delete().in("id", studentIds);
  }
});

function rowFor(page: import("@playwright/test").Page, key: CardKey) {
  return page.getByRole("row", { name: new RegExp(LAST_NAME[key]) });
}

test.describe("כרטיסים חדשים - דסקטופ", () => {
  test.use({ viewport: DESKTOP_VIEWPORT });

  test("תג 'חדש היום' ו'חדש השבוע' מופיעים ליד השם, וכרטיס ישן בלי תג", async ({
    page,
  }) => {
    // Arrange
    await page.goto("/app/students");
    await page.locator("#search").fill(token);

    // Assert
    await expect(rowFor(page, "fresh")).toBeVisible({ timeout: LOAD_TIMEOUT });
    await expect(
      rowFor(page, "fresh").getByTestId("new-card-badge"),
    ).toHaveText("חדש היום");
    await expect(
      rowFor(page, "thisWeek").getByTestId("new-card-badge"),
    ).toHaveText("חדש השבוע");
    await expect(rowFor(page, "old").getByTestId("new-card-badge")).toHaveCount(
      0,
    );
  });

  test("סינון 'חדשים' מסנן בשרת, וניקוי הסינון מחזיר את כולם", async ({
    page,
  }) => {
    // Arrange
    await page.goto("/app/students");
    await page.locator("#search").fill(token);
    await expect(rowFor(page, "old")).toBeVisible({ timeout: LOAD_TIMEOUT });

    // Act + Assert - היום
    await page.locator("#newCards").selectOption("today");
    await expect(rowFor(page, "old")).toHaveCount(0, { timeout: LOAD_TIMEOUT });
    await expect(rowFor(page, "thisWeek")).toHaveCount(0);
    await expect(rowFor(page, "fresh")).toBeVisible();

    // Act + Assert - השבוע
    await page.locator("#newCards").selectOption("week");
    await expect(rowFor(page, "thisWeek")).toBeVisible({
      timeout: LOAD_TIMEOUT,
    });
    await expect(rowFor(page, "old")).toHaveCount(0);

    // Act + Assert - ניקוי הסינון מאפס גם את "חדשים"
    await page.getByRole("button", { name: "ניקוי הסינון" }).click();
    await expect(page.locator("#newCards")).toHaveValue("");
    await expect(rowFor(page, "old")).toBeVisible({ timeout: LOAD_TIMEOUT });
  });

  test("מיון לפי תאריך הוספה מציג את החדש קודם", async ({ page }) => {
    // Arrange
    await page.goto("/app/students");
    await page.locator("#search").fill(token);
    const rows = page.getByRole("row", { name: /^כרטיס מלא:/ });
    await expect(rows).toHaveCount(CARD_KEYS.length, { timeout: LOAD_TIMEOUT });

    // Act
    await page.getByRole("button", { name: "מיון לפי נוסף" }).click();

    // Assert
    await expect
      .poll(() =>
        rows.evaluateAll((els) =>
          els.map((el) => el.getAttribute("aria-label")),
        ),
      )
      .toEqual(
        CARD_KEYS.map((key) => `כרטיס מלא: ${FIRST_NAME} ${LAST_NAME[key]}`),
      );
  });
});

test.describe("כרטיסים חדשים - מובייל", () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test("התג מופיע גם בכותרת הכרטיס במובייל", async ({ page }) => {
    // Arrange
    await page.goto("/app/students");
    await page.getByRole("button", { name: "חיפוש וסינון" }).click();
    await page.locator("#m-search").fill(token);

    // Assert
    // השם והתג באותו אלמנט: ממקדים בכרטיס של הריצה הזו ולא בכל התגים ברשימה
    await expect(
      page.getByText(LAST_NAME.fresh).getByTestId("new-card-badge"),
    ).toHaveText("חדש היום", { timeout: LOAD_TIMEOUT });
  });
});
