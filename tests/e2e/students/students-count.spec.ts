/**
 * Callers: Playwright `chromium` project (שדכן).
 * כותרת "מאגר קול מצהלות" ומספר הכרטיסים לצדה: זהה לסך הכל של העימוד, משתנה
 * עם הסינון, ובסינון פעיל מציג גם "מתוך N במאגר" (הסך הלא מסונן).
 */
import { expect, test, type Page } from "@playwright/test";

import { approvedCard } from "../helpers/approved-card";
import { createServiceClient, getTestUserId } from "../shidduchim/fixtures";

const DESKTOP = { width: 1440, height: 900 };
const LOAD = { timeout: 15_000 };
const SEEDED = 3;

const admin = createServiceClient();
const token = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
let studentIds: string[] = [];

test.use({ viewport: DESKTOP });

test.beforeAll(async () => {
  const userId = await getTestUserId(admin);
  const rows = Array.from({ length: SEEDED }, (_, index) => ({
    user_id: userId,
    first_name: "ספירה",
    last_name: `מונה${token}${index}`,
    birth_date: "1998-01-01",
    gender: "male",
    personal_status: "single",
    country: "ישראל",
    city: "בני ברק",
    in_shidduchim: true,
  }));
  const { data, error } = await admin
    .from("students")
    .insert(approvedCard(rows))
    .select("id");
  if (error || !data) throw new Error(`זריעה נכשלה: ${error?.message}`);
  studentIds = data.map((row) => row.id as string);
});

test.afterAll(async () => {
  if (studentIds.length > 0) {
    await admin.from("students").delete().in("id", studentIds);
  }
});

const total = (page: Page) => page.getByTestId("students-count-total");
const pool = (page: Page) => page.getByTestId("students-count-pool");

/** המספר שמוצג, כמספר */
async function shownTotal(page: Page): Promise<number> {
  await expect(total(page)).toBeVisible(LOAD);
  return Number(await total(page).getAttribute("data-total"));
}

test("הכותרת היא 'מאגר קול מצהלות'", async ({ page }) => {
  await page.goto("/app/students");

  await expect(
    page.getByRole("heading", { level: 1, name: /מאגר קול מצהלות/ }),
  ).toBeVisible(LOAD);
  await expect(page.getByText("רשימת פרחי אנ״ש")).toHaveCount(0);
});

test("בלי סינון: המספר זהה לסך הכל של העימוד, ובלי 'מתוך'", async ({
  page,
}) => {
  await page.goto("/app/students");

  const shown = await shownTotal(page);
  await expect(page.getByTestId("students-range")).toHaveText(
    new RegExp(`מתוך ${shown}$`),
    LOAD,
  );
  expect(shown).toBeGreaterThanOrEqual(SEEDED);
  await expect(page.getByTestId("students-count")).toContainText("במאגר");
  await expect(pool(page)).toHaveText("");
});

test("סינון: המספר משתנה, ומוצג 'מתוך N במאגר'; ניקוי מחזיר", async ({
  page,
}) => {
  // Arrange
  await page.goto("/app/students");
  const poolTotal = await shownTotal(page);

  // Act
  await page.locator("#search").fill(token);

  // Assert
  await expect(total(page)).toHaveAttribute("data-total", String(SEEDED), LOAD);
  await expect(page.getByTestId("students-range")).toHaveText(
    `מציג 1–${SEEDED} מתוך ${SEEDED}`,
    LOAD,
  );
  await expect(page.getByTestId("students-count")).toContainText(
    "תואמים לסינון",
  );
  await expect(pool(page)).toContainText(
    `מתוך ${poolTotal.toLocaleString("he-IL")} במאגר`,
    LOAD,
  );

  // Act
  await page.locator("#search").fill("");

  // Assert
  await expect(total(page)).toHaveAttribute(
    "data-total",
    String(poolTotal),
    LOAD,
  );
  await expect(pool(page)).toHaveText("");
});

test("סינון בלי תוצאות: 0 אמיתי, ו'מתוך N במאגר'", async ({ page }) => {
  await page.goto("/app/students");
  await shownTotal(page);

  await page.locator("#search").fill(`לאקיים${token}`);

  await expect(total(page)).toHaveAttribute("data-total", "0", LOAD);
  await expect(pool(page)).toContainText("במאגר", LOAD);
});

test("שגיאת טעינה: לא מוצג מספר (ולא 0 שגוי)", async ({ page }) => {
  // Arrange: כשל בשאילתת הרשימה
  await page.route("**/rest/v1/student_cards*", (route) =>
    route.fulfill({ status: 500, body: "{}" }),
  );

  // Act
  await page.goto("/app/students");

  // Assert
  await expect(page.getByText("לא הצלחנו לטעון את רשימת המיועדים")).toBeVisible(
    LOAD,
  );
  await expect(page.getByTestId("students-count")).toHaveCount(0);
  await expect(page.getByTestId("students-count-loading")).toHaveCount(0);
});

test("בטעינה מוצג שלד", async ({ page }) => {
  // Arrange: מעכבים את תשובת הרשימה
  await page.route("**/rest/v1/student_cards*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });

  // Act
  await page.goto("/app/students");

  // Assert
  await expect(page.getByTestId("students-count-loading")).toBeVisible();
  await expect(page.getByTestId("students-count-total")).toBeVisible(LOAD);
});
