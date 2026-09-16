import { test, expect } from "@playwright/test";

import { createServiceClient, getTestUserId } from "../shidduchim/fixtures";

/**
 * בטבלת המיועדים, עמודת "שם פרטי" מציגה את הכינוי בסוגריים מיד אחרי השם.
 * כרטיס בלי כינוי מציג את השם בלבד, בלי סוגריים ריקים.
 */
const TABLE_CAPTION = "רשימת המיועדים";
const NICKNAME = "בערל";
const RUN_ID = Date.now();
const WITH_NICKNAME = { first: "יצחק", last: `כינוי${RUN_ID}` };
const WITHOUT_NICKNAME = { first: "אהרן", last: `בלי${RUN_ID}` };

const admin = createServiceClient();
const ids: string[] = [];

test.beforeAll(async () => {
  const userId = await getTestUserId(admin);
  const rows = [
    {
      user_id: userId,
      first_name: WITH_NICKNAME.first,
      last_name: WITH_NICKNAME.last,
      nickname: NICKNAME,
      birth_date: "1998-02-02",
      gender: "male",
      personal_status: "single",
      country: "ישראל",
      city: "בני ברק",
      in_shidduchim: true,
    },
    {
      user_id: userId,
      first_name: WITHOUT_NICKNAME.first,
      last_name: WITHOUT_NICKNAME.last,
      nickname: null,
      birth_date: "1998-03-03",
      gender: "male",
      personal_status: "single",
      country: "ישראל",
      city: "בני ברק",
      in_shidduchim: true,
    },
  ];

  const { data, error } = await admin
    .from("students")
    .insert(rows)
    .select("id");
  if (error || !data) {
    throw new Error(`יצירת כרטיסי הבדיקה נכשלה: ${error?.message}`);
  }
  ids.push(...data.map((row) => row.id as string));
});

test.afterAll(async () => {
  if (ids.length > 0) await admin.from("students").delete().in("id", ids);
});

test("הכינוי מוצג בסוגריים אחרי השם הפרטי", async ({ page }) => {
  // Arrange
  await page.goto("/app/students");
  await page.locator("#search").fill(String(RUN_ID));
  const table = page.getByRole("table", { name: TABLE_CAPTION });
  await expect(table.getByRole("row", { name: /^כרטיס מלא:/ })).toHaveCount(2, {
    timeout: 15_000,
  });

  // Assert - עם כינוי
  const withNickname = table.getByRole("row", {
    name: `כרטיס מלא: ${WITH_NICKNAME.first} ${WITH_NICKNAME.last}`,
  });
  await expect(
    withNickname.getByRole("cell", {
      name: `${WITH_NICKNAME.first} (${NICKNAME})`,
      exact: true,
    }),
  ).toBeVisible();

  // Assert - בלי כינוי: השם בלבד, בלי סוגריים
  const withoutNickname = table.getByRole("row", {
    name: `כרטיס מלא: ${WITHOUT_NICKNAME.first} ${WITHOUT_NICKNAME.last}`,
  });
  await expect(
    withoutNickname.getByRole("cell", {
      name: WITHOUT_NICKNAME.first,
      exact: true,
    }),
  ).toBeVisible();
  await expect(withoutNickname.getByText("(")).toHaveCount(0);
});
