import { test, expect, type Locator, type Page } from "@playwright/test";

import { createServiceClient, getTestUserId } from "../shidduchim/fixtures";

/**
 * עימוד, מיון וסינון בשרת ברשימת המיועדים: 60 כרטיסים (עמוד של 50 + 10).
 * שם המשפחה עולה עם האינדקס, והגובה יורד איתו (199..140) - כך שהנמוך ביותר
 * ברשימה כולה נמצא בעמוד השני של סדר ברירת המחדל, ומיון לפי גובה שמכבד
 * רק את העמוד הנוכחי היה נכשל.
 */
const TABLE_CAPTION = "רשימת המיועדים";
const FIRST_NAME = "עמוד";
const PAGE_SIZE = 50;
const TOTAL = 60;
const MAX_HEIGHT = 200;
/** גובה מינימלי שמשאיר את הכרטיסים 1..55 - עמוד מלא ועוד 5 */
const FILTER_HEIGHT_MIN = 145;
const FILTERED_TOTAL = MAX_HEIGHT - FILTER_HEIGHT_MIN;
const DESKTOP_VIEWPORT = { width: 1440, height: 900 };
const LOAD_TIMEOUT = 15_000;
const THUMBNAILS_URL = "**/api/v1/students/photos/thumbnails";

const admin = createServiceClient();
/** מחרוזת ייחודית בשם המשפחה - החיפוש מציג רק את כרטיסי הבדיקה */
const token = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
let studentIds: string[] = [];
/** מזהה הכרטיס לפי האינדקס (1..60), לבדיקת שליחת התמונות */
const idByIndex = new Map<number, string>();

const indices = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

const lastNameOf = (index: number) =>
  `לוי${token}${String(index).padStart(2, "0")}`;

const labelOf = (index: number) =>
  `כרטיס מלא: ${FIRST_NAME} ${lastNameOf(index)}`;

const labelsOf = (list: number[]) => list.map(labelOf);

test.beforeAll(async () => {
  const userId = await getTestUserId(admin);
  const rows = indices(1, TOTAL).map((index) => ({
    user_id: userId,
    first_name: FIRST_NAME,
    last_name: lastNameOf(index),
    birth_date: "1998-01-01",
    gender: "male",
    personal_status: "single",
    country: "ישראל",
    city: "בני ברק",
    height: MAX_HEIGHT - index,
    photo_count: 1,
    in_shidduchim: true,
  }));
  const { data, error } = await admin
    .from("students")
    .insert(rows)
    .select("id, last_name");
  if (error || !data) {
    throw new Error(`יצירת כרטיסי הבדיקה נכשלה: ${error?.message}`);
  }
  studentIds = data.map((row) => row.id as string);
  for (const row of data) {
    idByIndex.set(Number(String(row.last_name).slice(-2)), row.id as string);
  }
});

test.afterAll(async () => {
  if (studentIds.length > 0) {
    await admin.from("students").delete().in("id", studentIds);
  }
});

test.use({ viewport: DESKTOP_VIEWPORT });

function readOrder(rows: Locator) {
  return rows.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("aria-label")),
  );
}

function tableRows(page: Page) {
  return page
    .getByRole("table", { name: TABLE_CAPTION })
    .getByRole("row", { name: /^כרטיס מלא:/ });
}

async function openListFilteredToTestCards(page: Page) {
  await page.goto("/app/students");
  await page.locator("#search").fill(token);
  await expect(tableRows(page)).toHaveCount(PAGE_SIZE, {
    timeout: LOAD_TIMEOUT,
  });
}

const range = (page: Page) => page.getByTestId("students-range");
const goToPage = (page: Page, number: number) =>
  page.getByRole("link", { name: `עמוד ${number}`, exact: true }).click();

test("עמוד ראשון: 50 הראשונים בסדר ברירת המחדל, עם הסך הכל", async ({
  page,
}) => {
  // Act
  await openListFilteredToTestCards(page);

  // Assert
  await expect(range(page)).toHaveText(`מציג 1–${PAGE_SIZE} מתוך ${TOTAL}`);
  await expect
    .poll(() => readOrder(tableRows(page)))
    .toEqual(labelsOf(indices(1, PAGE_SIZE)));
  await expect(page.getByRole("link", { name: "עמוד קודם" })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
});

test("עמוד הבא מציג את השאר, וניתן להגיע אליו במקלדת", async ({ page }) => {
  // Arrange
  await openListFilteredToTestCards(page);
  const next = page.getByRole("link", { name: "עמוד הבא" });

  // Act - פוקוס במקלדת ו-Enter
  await next.focus();
  await page.keyboard.press("Enter");

  // Assert
  await expect(tableRows(page)).toHaveCount(TOTAL - PAGE_SIZE, {
    timeout: LOAD_TIMEOUT,
  });
  await expect
    .poll(() => readOrder(tableRows(page)))
    .toEqual(labelsOf(indices(PAGE_SIZE + 1, TOTAL)));
  await expect(range(page)).toHaveText(
    `מציג ${PAGE_SIZE + 1}–${TOTAL} מתוך ${TOTAL}`,
  );
  await expect(next).toHaveAttribute("aria-disabled", "true");

  // Act - חזרה לעמוד הראשון
  await page.getByRole("link", { name: "עמוד קודם" }).click();

  // Assert
  await expect(tableRows(page)).toHaveCount(PAGE_SIZE, {
    timeout: LOAD_TIMEOUT,
  });
  await expect(range(page)).toHaveText(`מציג 1–${PAGE_SIZE} מתוך ${TOTAL}`);
});

test("מיון לפי גובה חל על כל הרשימה, ומחזיר לעמוד הראשון", async ({ page }) => {
  // Arrange - עוברים לעמוד 2 ואז ממיינים
  await openListFilteredToTestCards(page);
  await goToPage(page, 2);
  await expect(tableRows(page)).toHaveCount(TOTAL - PAGE_SIZE, {
    timeout: LOAD_TIMEOUT,
  });

  // Act
  await page
    .getByRole("table", { name: TABLE_CAPTION })
    .getByRole("button", { name: "מיון לפי גובה" })
    .click();

  // Assert - הנמוך ביותר בכל הרשימה (הכרטיס ה-60) הוא הראשון בעמוד 1
  await expect(tableRows(page)).toHaveCount(PAGE_SIZE, {
    timeout: LOAD_TIMEOUT,
  });
  await expect(range(page)).toHaveText(`מציג 1–${PAGE_SIZE} מתוך ${TOTAL}`);
  await expect
    .poll(() => readOrder(tableRows(page)))
    .toEqual(labelsOf(indices(TOTAL - PAGE_SIZE + 1, TOTAL).reverse()));

  // Act + Assert - העמוד השני ממשיך את אותו מיון: הגבוהים ביותר
  await goToPage(page, 2);
  await expect
    .poll(() => readOrder(tableRows(page)))
    .toEqual(labelsOf(indices(1, TOTAL - PAGE_SIZE).reverse()));
});

test("שינוי סינון מחזיר לעמוד הראשון", async ({ page }) => {
  // Arrange
  await openListFilteredToTestCards(page);
  await goToPage(page, 2);
  await expect(range(page)).toHaveText(
    `מציג ${PAGE_SIZE + 1}–${TOTAL} מתוך ${TOTAL}`,
    { timeout: LOAD_TIMEOUT },
  );

  // Act
  await page.getByRole("button", { name: "סינון מתקדם" }).click();
  await page.locator("#heightMin").fill(String(FILTER_HEIGHT_MIN));

  // Assert
  await expect(range(page)).toHaveText(
    `מציג 1–${PAGE_SIZE} מתוך ${FILTERED_TOTAL}`,
    { timeout: LOAD_TIMEOUT },
  );
  await expect
    .poll(() => readOrder(tableRows(page)))
    .toEqual(labelsOf(indices(1, PAGE_SIZE)));
});

test("סינון, מיון ועמוד יחד", async ({ page }) => {
  // Arrange
  await openListFilteredToTestCards(page);
  await page.getByRole("button", { name: "סינון מתקדם" }).click();
  await page.locator("#heightMin").fill(String(FILTER_HEIGHT_MIN));
  await expect(range(page)).toHaveText(
    `מציג 1–${PAGE_SIZE} מתוך ${FILTERED_TOTAL}`,
    { timeout: LOAD_TIMEOUT },
  );

  // Act - גובה עולה, ועמוד שני
  await page
    .getByRole("table", { name: TABLE_CAPTION })
    .getByRole("button", { name: "מיון לפי גובה" })
    .click();
  await expect
    .poll(() => readOrder(tableRows(page)))
    .toEqual(
      labelsOf(
        indices(FILTERED_TOTAL - PAGE_SIZE + 1, FILTERED_TOTAL).reverse(),
      ),
    );
  await goToPage(page, 2);

  // Assert - 5 הגבוהים ביותר מבין המסוננים, בסדר עולה
  await expect(range(page)).toHaveText(
    `מציג ${PAGE_SIZE + 1}–${FILTERED_TOTAL} מתוך ${FILTERED_TOTAL}`,
    { timeout: LOAD_TIMEOUT },
  );
  await expect
    .poll(() => readOrder(tableRows(page)))
    .toEqual(labelsOf(indices(1, FILTERED_TOTAL - PAGE_SIZE).reverse()));
});

test("תמונות ממוזערות מתבקשות רק לשורות העמוד הנוכחי", async ({ page }) => {
  // Arrange
  const requestedBatches: string[][] = [];
  await page.route(THUMBNAILS_URL, async (route) => {
    const body = route.request().postDataJSON() as { studentIds: string[] };
    requestedBatches.push(body.studentIds);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ thumbnails: {} }),
    });
  });

  // Act - עמוד ראשון. הרשימה הלא מסוננת שנטענת לפני החיפוש מבקשת גם היא
  // תמונות לשורותיה, ובקשות הבאות מדלגות על מזהים שכבר נשאלו - ולכן בודקים
  // את איחוד הבקשות ולא בקשה בודדת
  await openListFilteredToTestCards(page);
  const firstPageIds = indices(1, PAGE_SIZE).map((i) => idByIndex.get(i));
  const requestedIds = () => new Set(requestedBatches.flat());

  // Assert - כל שורות העמוד הראשון נשאלו, ואף בקשה לא עולה על גודל עמוד
  await expect
    .poll(() => firstPageIds.every((id) => requestedIds().has(id as string)))
    .toBe(true);
  expect(requestedBatches.every((batch) => batch.length <= PAGE_SIZE)).toBe(
    true,
  );

  // Act - עמוד שני
  await goToPage(page, 2);

  // Assert - הבקשה החדשה כוללת רק את 10 הכרטיסים החדשים, בלי עמוד ראשון שוב
  const secondPageIds = indices(PAGE_SIZE + 1, TOTAL).map((i) =>
    idByIndex.get(i),
  );
  await expect
    .poll(() =>
      requestedBatches.some(
        (batch) =>
          [...batch].sort().join() === [...secondPageIds].sort().join(),
      ),
    )
    .toBe(true);
  expect(requestedBatches.every((batch) => batch.length <= PAGE_SIZE)).toBe(
    true,
  );
});
