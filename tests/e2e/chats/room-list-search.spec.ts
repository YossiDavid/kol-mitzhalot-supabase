import { expect, test, type Page } from "@playwright/test";

import {
  createServiceClient,
  ensureCardManagerId,
  getTestUserId,
} from "../shidduchim/fixtures";
import {
  deleteRoomsAmong,
  ensureSecondParentId,
  sendAs,
} from "./context-fixtures";

/**
 * חיפוש וסינון ברשימת הצ'אטים: החיפוש מוצא לפי ההודעה האחרונה (וגם לפי שם
 * והקשר), והסינון "על כרטיס" מציג רק שרשורי כרטיס. משתמש הבדיקה (שדכן) מול
 * שני הורים, בשתי שיחות כלליות.
 */
const RUN_ID = Date.now();
const LOAD_TIMEOUT = 15_000;

const admin = createServiceClient();
let shadchanId = "";
let parentA = "";
let parentB = "";
let roomA = "";
let roomB = "";

async function createGeneralRoom(otherId: string): Promise<string> {
  const [userA, userB] = [shadchanId, otherId].sort();
  const { data, error } = await admin
    .from("chat_rooms")
    .insert({ user_a: userA, user_b: userB, created_by: shadchanId })
    .select("room_id")
    .single();
  if (error || !data) throw new Error(`יצירת חדר נכשלה: ${error?.message}`);
  await admin.from("chat_room_participants").insert([
    { room_id: data.room_id, user_id: shadchanId },
    { room_id: data.room_id, user_id: otherId },
  ]);
  return data.room_id as string;
}

const roomsAside = (page: Page) =>
  page.getByRole("complementary", { name: "רשימת הצ'אטים" });

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  shadchanId = await getTestUserId(admin);
  parentA = await ensureCardManagerId(admin);
  parentB = await ensureSecondParentId(admin);
  await deleteRoomsAmong(admin, [shadchanId, parentA, parentB]);
  roomA = await createGeneralRoom(parentA);
  roomB = await createGeneralRoom(parentB);
  await sendAs(admin, roomA, parentA, `מילת חיפוש ${RUN_ID}`);
  await sendAs(admin, roomB, parentB, "הודעה אחרת לגמרי");
});

test.afterAll(async () => {
  await deleteRoomsAmong(admin, [shadchanId, parentA, parentB]);
});

test("חיפוש לפי תוכן ההודעה מציג רק את השיחה המתאימה", async ({ page }) => {
  // Arrange
  await page.goto("/app/chats");
  const aside = roomsAside(page);
  await expect(aside.locator(`a[data-room-id="${roomA}"]`)).toBeVisible({
    timeout: LOAD_TIMEOUT,
  });
  await expect(aside.locator(`a[data-room-id="${roomB}"]`)).toBeVisible();

  // Act
  await aside
    .getByRole("searchbox", { name: "חיפוש בצ'אטים" })
    .fill(`חיפוש ${RUN_ID}`);

  // Assert
  await expect(aside.locator(`a[data-room-id="${roomA}"]`)).toBeVisible();
  await expect(aside.locator(`a[data-room-id="${roomB}"]`)).toHaveCount(0);
});

test("סינון 'על כרטיס' בלי שרשורי כרטיס מציג שאין תוצאות", async ({ page }) => {
  // Arrange
  await page.goto("/app/chats");
  const aside = roomsAside(page);
  await expect(aside.locator(`a[data-room-id="${roomA}"]`)).toBeVisible({
    timeout: LOAD_TIMEOUT,
  });

  // Act
  await aside.getByRole("radio", { name: "על כרטיס" }).click();

  // Assert
  await expect(aside.locator(`a[data-room-id="${roomA}"]`)).toHaveCount(0);
  await expect(aside.locator(`a[data-room-id="${roomB}"]`)).toHaveCount(0);

  // Act - חזרה ל"הכל"
  await aside.getByRole("radio", { name: "הכל" }).click();

  // Assert
  await expect(aside.locator(`a[data-room-id="${roomB}"]`)).toBeVisible();
});
