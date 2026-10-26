import { expect, test } from "@playwright/test";

import { createServiceClient } from "../shidduchim/fixtures";

/**
 * סדר ברשימת השדכנים: כרטיסי הרשימה באותו גובה ובמבנה קבוע, טבלת המנהל
 * תמציתית עם "—" לערך חסר וסימון לתיאור קצר, והתצוגה המקדימה והערה
 * להנהלה בעריכת מנהל ובעמוד הבקשות.
 */
const LOAD_TIMEOUT = 15_000;
const RUN_ID = Date.now();
const SORT_FIRST_LAST_NAME = "אאאא";
const LONG_BIO = `${"אני שדכנית עם ניסיון רב בשידוכים בקהילות שונות. ".repeat(12)}סוף`;
const NOTE = `אשמח להצטרף, מכירה את המערכת ${RUN_ID}`;
const HEIGHT_TOLERANCE_PX = 1;
const MOBILE_VIEWPORT = { width: 390, height: 844 };
const DESKTOP_VIEWPORT = { width: 1440, height: 900 };

const service = createServiceClient();

interface Fixture {
  key: "long" | "empty" | "short" | "pending";
  email: string;
  firstName: string;
  bio: string | null;
  status: "approved" | "pending";
  city: string | null;
}

const fixtures: Fixture[] = [
  {
    key: "long",
    email: `dir-long-${RUN_ID}@kol-mitzhalot.test`,
    firstName: `ארוך${RUN_ID}`,
    bio: LONG_BIO,
    status: "approved",
    city: "ירושלים",
  },
  {
    key: "empty",
    email: `dir-empty-${RUN_ID}@kol-mitzhalot.test`,
    firstName: `ריק${RUN_ID}`,
    bio: null,
    status: "approved",
    city: null,
  },
  {
    key: "short",
    email: `dir-short-${RUN_ID}@kol-mitzhalot.test`,
    firstName: `קצר${RUN_ID}`,
    bio: "שדכן",
    status: "approved",
    city: null,
  },
  {
    key: "pending",
    email: `dir-pending-${RUN_ID}@kol-mitzhalot.test`,
    firstName: `ממתין${RUN_ID}`,
    bio: "שלום וברכה אני שדכנית בתחילת הדרך אשמח להתחבר",
    status: "pending",
    city: null,
  },
];
const idByKey: Record<string, string> = {};

test.beforeAll(async () => {
  const tail = Number(String(RUN_ID).slice(-7));
  for (const [index, fixture] of fixtures.entries()) {
    const { data, error } = await service.auth.admin.createUser({
      email: fixture.email,
      phone: `+9725${String(tail * 10 + index).padStart(8, "0")}`,
      email_confirm: true,
      phone_confirm: true,
      app_metadata: {
        roles: fixture.status === "approved" ? ["shadchan"] : [],
      },
      user_metadata: {
        firstName: fixture.firstName,
        lastName: SORT_FIRST_LAST_NAME,
        phone_verified: true,
      },
    });
    if (error || !data.user) throw new Error(`יצירת שדכן: ${error?.message}`);
    const id = data.user.id;
    idByKey[fixture.key] = id;
    await service.from("user_profiles").upsert({
      id,
      first_name: fixture.firstName,
      last_name: SORT_FIRST_LAST_NAME,
    });
    const now = new Date().toISOString();
    const { error: infoError } = await service.from("shadchanim_info").insert({
      user_id: id,
      application_status: fixture.status,
      submitted_at: now,
      approved_at: fixture.status === "approved" ? now : null,
      bio: fixture.bio,
      location: fixture.city,
      contact_phone: "0501234567",
      community: "בעלזא",
      synagogue_rabbi: "הרב בדיקה",
      application_note: fixture.key === "pending" ? NOTE : null,
    });
    if (infoError) throw new Error(`שורת שדכן: ${infoError.message}`);
  }
});

test.afterAll(async () => {
  for (const id of Object.values(idByKey)) {
    await service.from("shadchanim_info").delete().eq("user_id", id);
    await service.auth.admin.deleteUser(id);
  }
});

async function cardHeights(page: import("@playwright/test").Page) {
  const cards = page.getByTestId("shadchan-list-item");
  await expect(cards.first()).toBeVisible({ timeout: LOAD_TIMEOUT });
  const boxes = await cards.evaluateAll((nodes) =>
    nodes.map((node) => node.getBoundingClientRect().height),
  );
  return boxes;
}

test.describe("רשימת השדכנים - כרטיסים אחידים", () => {
  for (const [label, viewport] of [
    ["דסקטופ", DESKTOP_VIEWPORT],
    ["מובייל", MOBILE_VIEWPORT],
  ] as const) {
    test(`כל הכרטיסים באותו גובה, גם עם תיאור ארוך וגם בלי (${label})`, async ({
      page,
    }) => {
      // Arrange
      await page.setViewportSize(viewport);

      // Act
      await page.goto("/app/shadchanim");
      const heights = await cardHeights(page);
      const long = page
        .getByTestId("shadchan-list-item")
        .filter({ hasText: fixtures[0].firstName });
      const empty = page
        .getByTestId("shadchan-list-item")
        .filter({ hasText: fixtures[1].firstName });

      // Assert
      await expect(long).toBeVisible();
      await expect(empty).toBeVisible();
      expect(heights.length).toBeGreaterThanOrEqual(3);
      expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(
        HEIGHT_TOLERANCE_PX,
      );
      await expect(empty.getByTestId("shadchan-card-description")).toHaveText(
        "",
      );
      await expect(
        page.getByTestId("shadchan-list-item").first(),
      ).toBeVisible();
      await expect(page.getByText("לא זמין")).toHaveCount(0);
      await expect(long.getByTestId("shadchan-card-meta")).toContainText(
        "ירושלים",
      );
      // כל כרטיס עם קישור לפרופיל ופניה לשדכן
      await expect(
        long.getByRole("link", { name: "לפרופיל המלא" }),
      ).toBeVisible();
      await expect(
        long.getByRole("button", { name: "פניה לשדכן" }),
      ).toBeVisible();
    });
  }
});

test.describe("טבלת השדכנים של המנהל", () => {
  test("עמודות תמציתיות, '—' לערך חסר וסימון תיאור חסר/קצר", async ({
    page,
  }) => {
    // Arrange
    await page.setViewportSize(DESKTOP_VIEWPORT);

    // Act
    // "הכל": הבדיקה כוללת גם בקשה ממתינה, שאינה בלשונית "שדכנים מורשים"
    await page.goto("/app/admin/shadchanim?group=all");
    const table = page.getByRole("table");
    await expect(table).toBeVisible({ timeout: LOAD_TIMEOUT });
    const rowOf = (key: Fixture["key"]) =>
      table
        .getByRole("row")
        .filter({ hasText: fixtures.find((f) => f.key === key)!.email });

    // Assert - כותרות
    for (const header of [
      "סטטוס",
      "שם",
      "אימייל",
      "הצטרף",
      "הצעות שנוצרו",
      "הצעות שנסגרו",
      "פעילות אחרונה",
      "נראה לאחרונה",
      "זמן פעילות",
      "פעולות",
    ]) {
      await expect(
        table.getByRole("columnheader", { name: header, exact: true }),
      ).toBeVisible();
    }
    await expect(table.getByRole("columnheader")).toHaveCount(10);

    // Assert - שורה: שם אחד, ערך חסר כ"—", בלי "לא זמין"
    const emptyRow = rowOf("empty");
    await expect(emptyRow).toContainText(fixtures[1].firstName);
    await expect(emptyRow.getByRole("cell").nth(6)).toHaveText("—");
    await expect(table.getByText("לא זמין")).toHaveCount(0);

    // Assert - סימון תיאור חסר/קצר
    await expect(
      rowOf("empty").getByTestId("short-description-badge"),
    ).toBeVisible();
    await expect(
      rowOf("short").getByTestId("short-description-badge"),
    ).toBeVisible();
    await expect(
      rowOf("long").getByTestId("short-description-badge"),
    ).toHaveCount(0);
    await expect(
      rowOf("pending").getByTestId("short-description-badge"),
    ).toHaveCount(0);
  });

  test("במובייל כל שדכן ככרטיס קומפקטי עם שם וסימון", async ({ page }) => {
    // Arrange
    await page.setViewportSize(MOBILE_VIEWPORT);

    // Act
    await page.goto("/app/admin/shadchanim");

    // Assert
    const badge = page
      .locator('[data-testid="short-description-badge"]:visible')
      .first();
    await expect(badge).toBeVisible({ timeout: LOAD_TIMEOUT });
    await expect(page.getByRole("table")).toBeHidden();
  });
});

test.describe("בקשות ועריכת מנהל", () => {
  test("עמוד הבקשות מציג בולט את 'למה כדאי לאשר אותי'", async ({ page }) => {
    // Act
    await page.goto("/app/admin/shadchanim/requests");
    const card = page
      .locator("[data-slot='card']")
      .filter({ hasText: fixtures[3].email });

    // Assert
    await expect(card.getByTestId("request-application-note")).toContainText(
      NOTE,
    );
    await expect(card.getByTestId("request-application-note")).toContainText(
      "להנהלה בלבד",
    );
  });

  test("עריכת מנהל: תצוגה מקדימה חיה, השדה להנהלה והתמחויות", async ({
    page,
  }) => {
    // Arrange
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto(`/app/admin/shadchanim/${idByKey.pending}/edit`);
    const card = page
      .getByTestId("shadchan-card-preview")
      .getByTestId("shadchan-card");
    await expect(card).toBeVisible({ timeout: LOAD_TIMEOUT });

    // Assert - מצב התחלתי מהמסד
    await expect(card.getByTestId("shadchan-card-name")).toHaveText(
      `${fixtures[3].firstName} ${SORT_FIRST_LAST_NAME}`,
    );
    await expect(page.getByLabel(/למה כדאי לאשר אותי/)).toHaveValue(NOTE);

    // Act
    const typed = `תיאור חדש שהמנהל הקליד ${RUN_ID}`;
    // הדף מוצג מהשרת לפני ההידרציה; ממלאים שוב עד שההקלדה נקלטת בטופס
    await expect(async () => {
      await page.getByLabel("ביוגרפיה").fill(typed);
      await page.getByLabel("עיר מגורים").fill("אשדוד");
      await expect(card.getByTestId("shadchan-card-description")).toHaveText(
        typed,
        { timeout: 1_000 },
      );
    }).toPass({ timeout: LOAD_TIMEOUT });

    // Assert
    await expect(card.getByTestId("shadchan-card-meta")).toContainText("אשדוד");
    await expect(page.getByTestId("bio-guidance")).toContainText(
      "יוצג לכל המשתמשים ברשימת השדכנים",
    );
  });
});
