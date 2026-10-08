import { expect, test, type Page } from "@playwright/test";

import { createServiceClient, getTestUserId } from "../shidduchim/fixtures";

/**
 * רשימת המיועדים: תג "מולא ע״י צד שלישי" רק בכרטיסי card_for = 'other', וסינון
 * "מילוי הכרטיס" בשרת (כרטיס ישן בלי card_for שייך ל"מיועדים והורים"),
 * בשילוב עם סינון אחר ונוקה ב"ניקוי הסינון".
 */
const LOAD_TIMEOUT = 15_000;
const TOKEN = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const MOBILE_VIEWPORT = { width: 390, height: 844 };

type CardKey = "self" | "child" | "legacy" | "other";
const SEEDS: Record<
  CardKey,
  { cardFor: string | null; gender: "male" | "female" }
> = {
  self: { cardFor: "self", gender: "male" },
  child: { cardFor: "child", gender: "male" },
  legacy: { cardFor: null, gender: "male" },
  other: { cardFor: "other", gender: "female" },
};
const KEYS = Object.keys(SEEDS) as CardKey[];
const lastName = (key: CardKey) => `${key}${TOKEN}`;

const admin = createServiceClient();
let studentIds: string[] = [];

test.beforeAll(async () => {
  const userId = await getTestUserId(admin);
  const { data, error } = await admin
    .from("students")
    .insert(
      KEYS.map((key) => ({
        user_id: userId,
        first_name: "סינון",
        last_name: lastName(key),
        birth_date: "1999-01-01",
        gender: SEEDS[key].gender,
        personal_status: "single",
        country: "ישראל",
        city: "בני ברק",
        in_shidduchim: true,
        card_for: SEEDS[key].cardFor,
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

const rowFor = (page: Page, key: CardKey) =>
  page.getByRole("row", { name: new RegExp(lastName(key)) });

async function openFilteredList(page: Page) {
  await page.goto("/app/students");
  await page.locator("#search").fill(TOKEN);
  await expect(rowFor(page, "self")).toBeVisible({ timeout: LOAD_TIMEOUT });
}

test.describe("תג צד שלישי וסינון מילוי הכרטיס", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("התג מופיע רק בכרטיס צד שלישי - לא בעצמי, הורה או כרטיס ישן", async ({
    page,
  }) => {
    // Arrange + Act
    await openFilteredList(page);

    // Assert
    await expect(
      rowFor(page, "other").getByTestId("third-party-card-tag"),
    ).toContainText("מידע בסיסי · מולא ע״י צד שלישי");
    await expect(
      rowFor(page, "other").getByTestId("third-party-card-tag"),
    ).toHaveAttribute("title", /לא ניתן לשלוח אליו הצעות/);
    for (const key of ["self", "child", "legacy"] as const) {
      await expect(rowFor(page, key)).toBeVisible();
      await expect(
        rowFor(page, key).getByTestId("third-party-card-tag"),
      ).toHaveCount(0);
    }
  });

  test("שלושה ערכים: הכל, מיועדים והורים (כולל ישן), צד שלישי", async ({
    page,
  }) => {
    // Arrange
    await openFilteredList(page);
    const filter = page.getByLabel("מילוי הכרטיס");
    await expect(filter.locator("option")).toHaveText([
      "הכל",
      "מיועדים והורים",
      "צד שלישי",
    ]);

    // Act + Assert - צד שלישי
    await filter.selectOption("third_party");
    await expect(rowFor(page, "self")).toHaveCount(0, {
      timeout: LOAD_TIMEOUT,
    });
    await expect(rowFor(page, "other")).toBeVisible();

    // Act + Assert - מיועדים והורים: כולל כרטיס ישן בלי card_for
    await filter.selectOption("direct");
    await expect(rowFor(page, "other")).toHaveCount(0, {
      timeout: LOAD_TIMEOUT,
    });
    for (const key of ["self", "child", "legacy"] as const) {
      await expect(rowFor(page, key)).toBeVisible();
    }

    // Act + Assert - הכל
    await filter.selectOption("");
    await expect(rowFor(page, "other")).toBeVisible({ timeout: LOAD_TIMEOUT });
    await expect(rowFor(page, "legacy")).toBeVisible();
  });

  test("משתלב עם סינון אחר, וניקוי הסינון מאפס אותו", async ({ page }) => {
    // Arrange
    await openFilteredList(page);
    const filter = page.getByLabel("מילוי הכרטיס");

    // Act - צד שלישי + זכר: אין כזה
    await filter.selectOption("third_party");
    await page.getByLabel("מגדר").selectOption("male");
    await expect(rowFor(page, "other")).toHaveCount(0, {
      timeout: LOAD_TIMEOUT,
    });
    await expect(rowFor(page, "self")).toHaveCount(0);

    // Act - צד שלישי + נקבה
    await page.getByLabel("מגדר").selectOption("female");
    await expect(rowFor(page, "other")).toBeVisible({ timeout: LOAD_TIMEOUT });

    // Act - ניקוי
    await page.getByRole("button", { name: "ניקוי הסינון" }).click();
    await expect(filter).toHaveValue("");
    await expect(page.getByLabel("מגדר")).toHaveValue("");
    await page.locator("#search").fill(TOKEN);
    await expect(rowFor(page, "self")).toBeVisible({ timeout: LOAD_TIMEOUT });
    await expect(rowFor(page, "other")).toBeVisible();
  });
});

test.describe("תג בנייד", () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test("התג מופיע בכותרת הכרטיס בנייד", async ({ page }) => {
    // Arrange
    await page.goto("/app/students");
    await page.getByRole("button", { name: /חיפוש וסינון/ }).click();
    await page.locator("#m-search").fill(TOKEN);

    // Assert
    const visibleTags = page.locator(
      '[data-testid="third-party-card-tag"]:visible',
    );
    await expect(visibleTags).toHaveCount(1, { timeout: LOAD_TIMEOUT });
  });
});

test.describe("הנחיה בכניסה להוספת כרטיס", () => {
  test("ההנחיה מופיעה פעם אחת ליד 'להוספת מיועד/ת' בלוח הבקרה", async ({
    page,
  }) => {
    // Act
    await page.goto("/app");

    // Assert
    const note = page.getByTestId("card-guidance-note");
    await expect(note).toHaveCount(1);
    await expect(note).toContainText("עד לאישור הנהלת המערכת");
  });
});
