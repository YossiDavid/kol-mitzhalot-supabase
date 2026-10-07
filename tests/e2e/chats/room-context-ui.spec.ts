import { expect, test, type Locator, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createServiceClient,
  getTestUserId,
  setupShidduchFixtures,
  teardownShidduchFixtures,
  type ShidduchFixtures,
} from "../shidduchim/fixtures";
import {
  createCard,
  deleteRoomsAmong,
  ensureSecondParentId,
  insertProposal,
  sendAs,
} from "./context-fixtures";

/**
 * רשימת הצ'אטים מקובצת לפי אדם, וכותרת החדר מקשרת להקשר שלו (כרטיס/הצעה).
 * משתמש הבדיקה (שדכן) מול מנהל הכרטיסים; החדרים נוצרים ב-service role כדי
 * שההרשאות ב-RPC לא יהיו חלק מהבדיקה הזו (ראו room-context-rpc.spec.ts).
 */
const REALTIME_TIMEOUT_MS = 15_000;

test.describe("שרשורי הקשר בצ'אט — ממשק", () => {
  test.describe.configure({ mode: "serial" });

  let admin: SupabaseClient;
  let fx: ShidduchFixtures;
  let shadchanId: string;
  let parentA: string;
  let parentB: string;
  let brideCard: string;
  let proposalId: string;
  let generalRoom: string;
  let studentRoom: string;
  let shidduchRoom: string;

  const everyone = () => [shadchanId, parentA, parentB];

  async function createRoom(
    context: Record<string, string | null>,
  ): Promise<string> {
    const [userA, userB] = [shadchanId, parentA].sort();
    const { data, error } = await admin
      .from("chat_rooms")
      .insert({
        user_a: userA,
        user_b: userB,
        created_by: shadchanId,
        ...context,
      })
      .select("room_id")
      .single();
    if (error || !data) throw new Error(`יצירת חדר נכשלה: ${error?.message}`);
    await admin.from("chat_room_participants").insert([
      { room_id: data.room_id, user_id: shadchanId },
      { room_id: data.room_id, user_id: parentA },
    ]);
    return data.room_id as string;
  }

  const roomsAside = (page: Page) =>
    page.getByRole("complementary", { name: "רשימת הצ׳אטים" });

  const threadLink = (page: Page, roomId: string): Locator =>
    page.locator(`a[data-room-id="${roomId}"]`);

  test.beforeAll(async () => {
    admin = createServiceClient();
    shadchanId = await getTestUserId(admin);
    fx = await setupShidduchFixtures(admin);
    parentA = fx.cardManagerId;
    parentB = await ensureSecondParentId(admin);
    brideCard = await createCard(admin, {
      userId: parentB,
      gender: "female",
      firstName: "כלה",
      lastName: "בדיקה",
    });
    await deleteRoomsAmong(admin, everyone());
    proposalId = await insertProposal(admin, {
      groomId: fx.groomFirst,
      brideId: brideCard,
      shadchanId,
    });

    generalRoom = await createRoom({});
    studentRoom = await createRoom({
      context_kind: "student",
      student_id: fx.groomFirst,
      context_label: "מיועד ראשון",
    });
    shidduchRoom = await createRoom({
      context_kind: "shidduch",
      shidduch_id: proposalId,
      context_label: "מיועד ראשון וכלה בדיקה",
    });

    // כל הקיים נחשב כנקרא; רק מה שיישלח בהמשך יידלק
    await admin
      .from("chat_room_participants")
      .update({ last_read_at: new Date().toISOString() })
      .eq("user_id", shadchanId);
  });

  test.afterAll(async () => {
    await deleteRoomsAmong(admin, everyone());
    await admin.from("shidduchim").delete().eq("id", proposalId);
    await admin.from("students").delete().eq("id", brideCard);
    await teardownShidduchFixtures(admin, fx);
  });

  test("הרשימה מקבצת את שלושת החדרים תחת אדם אחד, ולכל שרשור סימון משלו", async ({
    page,
  }) => {
    // Arrange - הודעה לא נקראה רק בשרשור הכרטיס
    await sendAs(admin, studentRoom, parentA, "שאלה על הכרטיס");

    // Act
    await page.goto("/app/chats");

    // Assert - רשומת אדם אחת, פתוחה כי יש בה שרשור שלא נקרא
    const group = roomsAside(page).locator(
      `[data-testid="person-group"][data-person-id="${parentA}"]`,
    );
    await expect(group).toHaveCount(1);
    await expect(group.getByRole("link")).toHaveCount(3);
    await expect(group.getByText("כללי")).toBeVisible();
    await expect(group.getByText("כרטיס: מיועד ראשון")).toBeVisible();
    await expect(group.getByText("הצעה: מיועד ראשון וכלה בדיקה")).toBeVisible();

    // סימון לא נקרא רק על שרשור הכרטיס, וסיכום ברמת האדם
    await expect(threadLink(page, studentRoom)).toHaveAttribute(
      "data-unread",
      "true",
    );
    await expect(threadLink(page, generalRoom)).not.toHaveAttribute(
      "data-unread",
      "true",
    );
    await expect(threadLink(page, shidduchRoom)).not.toHaveAttribute(
      "data-unread",
      "true",
    );
    await expect(group.locator('[data-slot="person-unread-count"]')).toHaveText(
      "1",
    );
  });

  test("הודעה חדשה בשרשור אחר מדליקה אותו בלי טעינה מחדש, ופתיחתו מכבה אותו", async ({
    page,
  }) => {
    // Arrange
    await page.goto("/app/chats");
    await expect(threadLink(page, shidduchRoom)).toBeVisible();

    // Act
    await sendAs(admin, shidduchRoom, parentA, "עדכון בנוגע להצעה");

    // Assert
    await expect(threadLink(page, shidduchRoom)).toHaveAttribute(
      "data-unread",
      "true",
      { timeout: REALTIME_TIMEOUT_MS },
    );

    await threadLink(page, shidduchRoom).click();
    await expect(page).toHaveURL(new RegExp(`/app/chats/${shidduchRoom}`));
    await expect(threadLink(page, shidduchRoom)).not.toHaveAttribute(
      "data-unread",
      "true",
      { timeout: REALTIME_TIMEOUT_MS },
    );
  });

  test("שרשור כרטיס: כפתור 'לכרטיס של ...' בפס ההקשר", async ({ page }) => {
    await page.goto(`/app/chats/${studentRoom}`);

    const bar = page.getByTestId("room-context-bar");
    await expect(bar).toContainText("כרטיס: מיועד ראשון");
    const button = bar.getByRole("link", { name: "לכרטיס של מיועד ראשון" });
    await expect(button).toHaveAttribute(
      "href",
      `/app/students/${fx.groomFirst}`,
    );
    // כפתור ולא קישור טקסט: יש לו מסגרת ותחום לחיצה של כפתור
    await expect(button).toHaveAttribute("data-slot", "button");
  });

  test("במובייל כפתורי ההקשר נשארים בתוך הרוחב וללא גלילה אופקית", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await page.goto(`/app/chats/${shidduchRoom}`);

    const bar = page.getByTestId("room-context-bar");
    await expect(
      bar.getByRole("link", { name: /לכרטיס של כלה בדיקה/ }),
    ).toBeVisible();
    const overflowsHorizontally = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(overflowsHorizontally).toBe(false);
  });

  test("שרשור הצעה: כפתורים להצעה ולכרטיסי שני הצדדים", async ({ page }) => {
    await page.goto(`/app/chats/${shidduchRoom}`);

    const bar = page.getByTestId("room-context-bar");
    await expect(bar).toContainText("הצעה: מיועד ראשון וכלה בדיקה");
    await expect(bar.getByRole("link", { name: "להצעה" })).toHaveAttribute(
      "href",
      `/app/shidduchim/${proposalId}`,
    );
    await expect(
      bar.getByRole("link", { name: "לכרטיס של מיועד ראשון" }),
    ).toHaveAttribute("href", `/app/students/${fx.groomFirst}`);
    await expect(
      bar.getByRole("link", { name: "לכרטיס של כלה בדיקה" }),
    ).toHaveAttribute("href", `/app/students/${brideCard}`);
  });

  test("שיחה כללית: לשדכן יש תפריט כרטיסי המשתמש עם קישור לכל כרטיס", async ({
    page,
  }) => {
    await page.goto(`/app/chats/${generalRoom}`);

    // אותו פס הקשר כמו בשאר השרשורים, עם התפריט כפתור גלוי
    await expect(page.getByTestId("room-context-bar")).toBeVisible();
    await page.getByRole("button", { name: "כרטיסי המשתמש" }).click();
    await expect(
      page.getByRole("menuitem", { name: "מיועד ראשון" }),
    ).toHaveAttribute("href", `/app/students/${fx.groomFirst}`);
    await expect(
      page.getByRole("menuitem", { name: "מיועדת ראשונה" }),
    ).toBeVisible();
  });

  test("הצעה שנמחקה: החדר נשאר עם התווית, בלי קישור", async ({ page }) => {
    // Arrange
    const otherProposal = await insertProposal(admin, {
      groomId: fx.groomSecond,
      brideId: brideCard,
      shadchanId,
    });
    const room = await createRoom({
      context_kind: "shidduch",
      shidduch_id: otherProposal,
      context_label: "מיועד שני וכלה בדיקה",
    });

    // Act
    await admin.from("shidduchim").delete().eq("id", otherProposal);
    await page.goto(`/app/chats/${room}`);

    // Assert
    const bar = page.getByTestId("room-context-bar");
    await expect(bar).toContainText("הצעה: מיועד שני וכלה בדיקה");
    await expect(bar).toContainText("ההצעה הוסרה מהמערכת");
    await expect(bar.getByRole("link", { name: "להצעה" })).toHaveCount(0);

    // הקבוצה סגורה כשאין שרשור שלא נקרא או חדר פעיל, ולכן פותחים אותה
    await page.goto("/app/chats");
    const group = roomsAside(page).locator(
      `[data-testid="person-group"][data-person-id="${parentA}"]`,
    );
    await group.getByRole("button", { expanded: false }).click();
    await expect(group.getByText("הצעה: מיועד שני וכלה בדיקה")).toBeVisible();
  });

  test("מי שאין לו אלא שיחה כללית אחת רואה שורה רגילה, בלי קבוצה", async ({
    page,
  }) => {
    // Arrange - אדם נוסף עם שיחה כללית בלבד
    const [userA, userB] = [shadchanId, parentB].sort();
    const { data } = await admin
      .from("chat_rooms")
      .insert({ user_a: userA, user_b: userB, created_by: shadchanId })
      .select("room_id")
      .single();
    await admin.from("chat_room_participants").insert([
      { room_id: data!.room_id, user_id: shadchanId },
      { room_id: data!.room_id, user_id: parentB },
    ]);

    // Act
    await page.goto("/app/chats");

    // Assert
    await expect(threadLink(page, data!.room_id)).toBeVisible();
    await expect(
      roomsAside(page).locator(
        `[data-testid="person-group"][data-person-id="${parentB}"]`,
      ),
    ).toHaveCount(0);
    await expect(
      roomsAside(page).locator(
        `[data-testid="person-group"][data-person-id="${parentA}"]`,
      ),
    ).toHaveCount(1);
  });
});
