import { expect, test } from "@playwright/test";

import { clientAs, createCard } from "../chats/context-fixtures";
import {
  TEST_USER_EMAIL,
  createServiceClient,
  ensureCardManagerId,
} from "../shidduchim/fixtures";

/**
 * שני שדות לכל כרטיס: "דיווח מורחב להנהלה" (פירוט חובה, עד 4000 תווים) ו"הערה
 * ותזכורת אישית" של השדכן - גלויה לכותב בלבד, לא לשדכנים האחרים ולא למנהל.
 * משתמש הבדיקה הוא שדכן.
 */
const ADMIN_EMAIL =
  process.env.TEST_ADMIN_EMAIL ?? "playwright-admin@kol-mitzhalot.test";
const RUN_ID = Date.now();
const LOAD_TIMEOUT = 15_000;

const service = createServiceClient();
let cardId = "";

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const managerId = await ensureCardManagerId(service);
  cardId = await createCard(service, {
    userId: managerId,
    gender: "female",
    firstName: "רחל",
    lastName: `דיווח${RUN_ID}`,
  });
});

test.afterAll(async () => {
  await service.from("card_reports").delete().eq("student_id", cardId);
  await service.from("student_notes").delete().eq("student_id", cardId);
  if (cardId) await service.from("students").delete().eq("id", cardId);
});

test("דיווח מורחב להנהלה: הסיבה בחורה, פירוט חובה, טקסט ארוך נשמר", async ({
  page,
}) => {
  // Arrange
  await page.goto(`/app/students/${cardId}`);
  await page.getByRole("button", { name: "עוד פעולות" }).click({
    timeout: LOAD_TIMEOUT,
  });
  await page.getByRole("menuitem", { name: "דיווח מורחב להנהלה" }).click();
  const dialog = page.getByTestId("report-card-dialog");
  await expect(dialog.locator("#report-reason")).toHaveValue("admin_update");

  // Act - בלי פירוט
  await dialog.getByRole("button", { name: "שליחת דיווח" }).click();

  // Assert
  await expect(dialog.getByTestId("report-card-error")).toHaveText(
    "יש לפרט את הדיווח",
  );

  // Act - פירוט ארוך (מעבר למגבלה הישנה של 1000)
  const longDetails = `שורה ראשונה\n${"פירוט ".repeat(300)}`;
  await dialog.locator("#report-details").fill(longDetails);
  await dialog.getByRole("button", { name: "שליחת דיווח" }).click();

  // Assert
  await expect(dialog).toBeHidden({ timeout: LOAD_TIMEOUT });
  const { data } = await service
    .from("card_reports")
    .select("reason, details")
    .eq("student_id", cardId);
  expect(data).toEqual([
    { reason: "admin_update", details: longDetails.trim() },
  ]);
});

test("הערה אישית: הכותב רואה אותה עם תג, מנהל ושדכנים אחרים לא", async ({
  page,
}) => {
  // Arrange
  await page.goto(`/app/students/${cardId}`);
  const composer = page.getByPlaceholder("הערה על המיועד/ת, גלויה לשדכנים...");
  await composer.fill(`תזכורת אישית ${RUN_ID}`);
  await page.getByLabel("הערה ותזכורת אישית - רק אני רואה").check();

  // Act
  await page.getByRole("button", { name: "שמירת הערה" }).click();

  // Assert - אצל הכותב, עם תג
  await expect(page.getByText(`תזכורת אישית ${RUN_ID}`)).toBeVisible();
  await expect(page.getByTestId("private-note-badge")).toBeVisible();

  // Assert - הכותב מקבל אותה מהמסד
  const author = await clientAs(service, TEST_USER_EMAIL);
  const own = await author.rpc("get_student_shadchan_notes", {
    p_student_id: cardId,
  });
  expect(own.error).toBeNull();
  expect(own.data).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        body: `תזכורת אישית ${RUN_ID}`,
        is_private: true,
      }),
    ]),
  );

  // Assert - המנהל אינו רואה, לא ב-RPC ולא בקריאה ישירה
  const adminClient = await clientAs(service, ADMIN_EMAIL);
  const viaRpc = await adminClient.rpc("get_student_shadchan_notes", {
    p_student_id: cardId,
  });
  expect(viaRpc.error).toBeNull();
  expect(viaRpc.data).toEqual([]);
  const direct = await adminClient
    .from("student_notes")
    .select("id")
    .eq("student_id", cardId);
  expect(direct.data).toEqual([]);
});
