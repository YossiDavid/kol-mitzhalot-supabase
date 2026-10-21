import { expect, test } from "@playwright/test";

import { serviceClient } from "../helpers/dedications";
import {
  createSessionUser,
  deleteSessionUsers,
  openPageAs,
  type SessionUser,
} from "../helpers/session-user";

/**
 * בורר "קהילה / חסידות" נפתח עם כל המאגר, לפי סדר הא"ב העברי - גם כשיש
 * במאגר יותר מ-50 קהילות (מגבלת ברירת המחדל של הבורר). נבדק בטופס
 * ההצטרפות כשדכן, שמשתמש בלי תפקיד רואה.
 */
const RUN_ID = Date.now();
/** יותר ממגבלת ברירת המחדל (50), כדי לוודא שהרשימה אינה נחתכת */
const SEEDED_COUNT = 60;
const LOAD = { timeout: 30_000 };

const admin = serviceClient();
let applicant: SessionUser;
let seededNames: string[] = [];

/** שמות בסדר לא ממוין: אותיות שונות בתחילת השם */
function seededName(index: number): string {
  const letters = ["ת", "א", "מ", "ב", "ש", "ג", "ק", "ד"];
  return `${letters[index % letters.length]}קהילת-מיון-${RUN_ID}-${index}`;
}

test.use({ storageState: { cookies: [], origins: [] } });

test.beforeAll(async () => {
  seededNames = Array.from({ length: SEEDED_COUNT }, (_, i) => seededName(i));
  const { error } = await admin
    .from("communities")
    .insert(seededNames.map((name) => ({ name, is_active: true })));
  if (error) throw new Error(`זריעת קהילות: ${error.message}`);
  applicant = await createSessionUser({ prefix: "community-order" });
});

test.afterAll(async () => {
  await admin.from("communities").delete().in("name", seededNames);
  await deleteSessionUsers([applicant]);
});

test('רשימת הקהילות נפתחת כולה ובסדר א"ב', async ({ browser }) => {
  // Arrange
  const page = await openPageAs(browser, applicant);

  try {
    await page.goto("/app/settings/shadchan");
    await expect(page.locator("#community")).toBeVisible(LOAD);

    // Act
    await page.locator("#community").click();
    const options = page.getByRole("option");
    await expect(options.filter({ hasText: seededNames[0] })).toBeVisible(LOAD);
    const labels = (await options.allInnerTexts()).map((text) => text.trim());

    // Assert
    for (const name of seededNames) expect(labels).toContain(name);
    const sorted = [...labels].sort((a, b) => a.localeCompare(b, "he"));
    expect(labels).toEqual(sorted);
  } finally {
    await page.context().close();
  }
});
