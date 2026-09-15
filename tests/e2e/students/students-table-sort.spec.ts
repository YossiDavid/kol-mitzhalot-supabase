import { test, expect, type Locator, type Page } from "@playwright/test";

import { createServiceClient, getTestUserId } from "../shidduchim/fixtures";

/**
 * מיון בטבלת המיועדים: בדסקטופ לחיצה על כותרת ממיינת עולה, יורד וחוזרת
 * לסדר המקורי (aria-sort מתעדכן), ערכים ריקים תמיד בסוף, וגיל "עולה" הוא
 * מהצעיר למבוגר. במובייל פקד מיון מעל הכרטיסים משנה את סדרם.
 */
const TABLE_CAPTION = "רשימת המיועדים";
const FIRST_NAME = "מיון";
const DESKTOP_VIEWPORT = { width: 1440, height: 900 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };
const LOAD_TIMEOUT = 15_000;
/** צילומי מסך לבדיקה ידנית - רק כשמבקשים במפורש */
const SCREENSHOT_DIR = process.env.TABLE_SORT_SCREENSHOT_DIR;

const admin = createServiceClient();
/** מחרוזת ייחודית בשם המשפחה - החיפוש מציג רק את כרטיסי הבדיקה */
const token = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

type StudentKey = "young" | "old" | "middle";

const STUDENTS: Record<
  StudentKey,
  { lastName: string; city: string; height: number | null; birthDate: string }
> = {
  young: {
    lastName: `אלון${token}`,
    city: "ירושלים",
    height: 185,
    birthDate: "2000-01-01",
  },
  old: {
    lastName: `בר${token}`,
    city: "אשדוד",
    height: null,
    birthDate: "1995-01-01",
  },
  middle: {
    lastName: `כהן${token}`,
    city: "בני ברק",
    height: 170,
    birthDate: "1998-01-01",
  },
};

const STUDENT_KEYS = Object.keys(STUDENTS) as StudentKey[];
let studentIds: string[] = [];

function cardLabel(key: StudentKey) {
  return `כרטיס מלא: ${FIRST_NAME} ${STUDENTS[key].lastName}`;
}

function labels(keys: StudentKey[]) {
  return keys.map(cardLabel);
}

test.beforeAll(async () => {
  const userId = await getTestUserId(admin);
  const { data, error } = await admin
    .from("students")
    .insert(
      STUDENT_KEYS.map((key) => ({
        user_id: userId,
        first_name: FIRST_NAME,
        last_name: STUDENTS[key].lastName,
        birth_date: STUDENTS[key].birthDate,
        gender: "male",
        personal_status: "single",
        country: "ישראל",
        city: STUDENTS[key].city,
        height: STUDENTS[key].height,
        in_shidduchim: true,
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

/** סדר השורות או הכרטיסים לפי השם הנגיש שלהם */
function readOrder(items: Locator) {
  return items.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("aria-label")),
  );
}

async function searchForTestStudents(page: Page, isMobile = false) {
  await page.goto("/app/students");
  if (!isMobile) {
    await page.locator("#search").fill(token);
    return;
  }
  // במובייל שדות הסינון נמצאים בפאנל שנפתח בלחיצה, עם קידומת m-
  await page.getByRole("button", { name: "חיפוש וסינון" }).click();
  await page.locator("#m-search").fill(token);
}

async function screenshot(page: Page, name: string) {
  if (!SCREENSHOT_DIR) return;
  await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png` });
}

test.describe("מיון טבלת המיועדים - דסקטופ", () => {
  test.use({ viewport: DESKTOP_VIEWPORT });

  test("לחיצה על כותרת ממיינת עולה ויורד, וריקים תמיד בסוף", async ({
    page,
  }) => {
    // Arrange
    await searchForTestStudents(page);
    const table = page.getByRole("table", { name: TABLE_CAPTION });
    const rows = table.getByRole("row", { name: /^כרטיס מלא:/ });
    await expect(rows).toHaveCount(STUDENT_KEYS.length, {
      timeout: LOAD_TIMEOUT,
    });
    const lastNameHeader = table.getByRole("columnheader", {
      name: "מיון לפי שם משפחה",
    });
    const lastNameButton = table.getByRole("button", {
      name: "מיון לפי שם משפחה",
    });
    const heightHeader = table.getByRole("columnheader", {
      name: "מיון לפי גובה",
    });
    const heightButton = table.getByRole("button", { name: "מיון לפי גובה" });
    await expect(lastNameHeader).toHaveAttribute("aria-sort", "none");

    // Act + Assert - שם משפחה: עולה, יורד, ובלחיצה שלישית בלי מיון
    await lastNameButton.click();
    await expect(lastNameHeader).toHaveAttribute("aria-sort", "ascending");
    await expect
      .poll(() => readOrder(rows))
      .toEqual(labels(["young", "old", "middle"]));

    await lastNameButton.click();
    await expect(lastNameHeader).toHaveAttribute("aria-sort", "descending");
    await expect
      .poll(() => readOrder(rows))
      .toEqual(labels(["middle", "old", "young"]));

    await lastNameButton.click();
    await expect(lastNameHeader).toHaveAttribute("aria-sort", "none");

    // Act + Assert - גובה: הכרטיס בלי גובה בסוף בשני הכיוונים
    await heightButton.click();
    await expect(heightHeader).toHaveAttribute("aria-sort", "ascending");
    await expect(lastNameHeader).toHaveAttribute("aria-sort", "none");
    await expect
      .poll(() => readOrder(rows))
      .toEqual(labels(["middle", "young", "old"]));

    await heightButton.click();
    await expect(heightHeader).toHaveAttribute("aria-sort", "descending");
    await expect
      .poll(() => readOrder(rows))
      .toEqual(labels(["young", "middle", "old"]));

    // Act + Assert - עיר לפי סדר האלף-בית
    await table.getByRole("button", { name: "מיון לפי עיר" }).click();
    await expect
      .poll(() => readOrder(rows))
      .toEqual(labels(["old", "middle", "young"]));
  });

  test("גיל בסדר עולה הוא מהצעיר למבוגר", async ({ page }) => {
    // Arrange
    await searchForTestStudents(page);
    const table = page.getByRole("table", { name: TABLE_CAPTION });
    const rows = table.getByRole("row", { name: /^כרטיס מלא:/ });
    await expect(rows).toHaveCount(STUDENT_KEYS.length, {
      timeout: LOAD_TIMEOUT,
    });
    const ageHeader = table.getByRole("columnheader", { name: "מיון לפי גיל" });
    const ageButton = table.getByRole("button", { name: "מיון לפי גיל" });

    // Act
    await ageButton.click();

    // Assert
    await expect(ageHeader).toHaveAttribute("aria-sort", "ascending");
    await expect
      .poll(() => readOrder(rows))
      .toEqual(labels(["young", "middle", "old"]));
    await screenshot(page, "desktop-1440-age-ascending");

    // Act
    await ageButton.click();

    // Assert
    await expect(ageHeader).toHaveAttribute("aria-sort", "descending");
    await expect
      .poll(() => readOrder(rows))
      .toEqual(labels(["old", "middle", "young"]));
  });
});

test.describe("מיון טבלת המיועדים - מובייל", () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test("פקד המיון מעל הכרטיסים משנה את סדרם", async ({ page }) => {
    // Arrange
    await searchForTestStudents(page, true);
    const list = page.getByRole("list", { name: TABLE_CAPTION });
    const cards = list.getByRole("group", { name: /^כרטיס מלא:/ });
    await expect(cards).toHaveCount(STUDENT_KEYS.length, {
      timeout: LOAD_TIMEOUT,
    });
    await expect(page.getByRole("table")).toHaveCount(0);
    const columnSelect = page.getByRole("combobox", {
      name: "מיון לפי",
      exact: true,
    });
    const directionButton = page.getByRole("button", { name: /^כיוון המיון/ });
    await expect(directionButton).toBeDisabled();

    // Act - מיון לפי עיר (עולה כברירת מחדל)
    await columnSelect.selectOption({ label: "עיר" });

    // Assert
    await expect
      .poll(() => readOrder(cards))
      .toEqual(labels(["old", "middle", "young"]));
    await expect(directionButton).toHaveAccessibleName("כיוון המיון: סדר עולה");

    // Act - היפוך הכיוון
    await directionButton.click();

    // Assert
    await expect(directionButton).toHaveAccessibleName("כיוון המיון: סדר יורד");
    await expect
      .poll(() => readOrder(cards))
      .toEqual(labels(["young", "middle", "old"]));

    // Act - גובה ביורד: הכרטיס בלי גובה עדיין בסוף
    await columnSelect.selectOption({ label: "גובה" });

    // Assert
    await expect
      .poll(() => readOrder(cards))
      .toEqual(labels(["young", "middle", "old"]));
    await columnSelect.scrollIntoViewIfNeeded();
    await screenshot(page, "mobile-390-sort-control");
  });
});
