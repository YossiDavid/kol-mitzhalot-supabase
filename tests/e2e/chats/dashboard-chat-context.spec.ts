import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createServiceClient,
  getTestUserId,
  setupShidduchFixtures,
  teardownShidduchFixtures,
  type ShidduchFixtures,
} from "../shidduchim/fixtures";
import { deleteRoomsAmong } from "./context-fixtures";

/**
 * כרטיסי הצ'אט בדשבורד מציגים לאיזה שרשור הם שייכים: שיחה כללית נראית כמו
 * תמיד, ושיחת כרטיס/הצעה מקבלת שורת הקשר (אותה כותרת כמו ברשימת הצ'אטים).
 */
test.describe("דשבורד — הקשר בכרטיסי הצ'אט", () => {
  test.describe.configure({ mode: "serial" });

  let admin: SupabaseClient;
  let fx: ShidduchFixtures;
  let shadchanId: string;
  let otherId: string;
  let generalRoom: string;
  let studentRoom: string;

  async function createRoom(
    context: Record<string, string | null>,
  ): Promise<string> {
    const [userA, userB] = [shadchanId, otherId].sort();
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
      { room_id: data.room_id, user_id: otherId },
    ]);
    return data.room_id as string;
  }

  test.beforeAll(async () => {
    admin = createServiceClient();
    shadchanId = await getTestUserId(admin);
    fx = await setupShidduchFixtures(admin);
    otherId = fx.cardManagerId;
    await deleteRoomsAmong(admin, [shadchanId, otherId]);
    generalRoom = await createRoom({});
    studentRoom = await createRoom({
      context_kind: "student",
      student_id: fx.groomFirst,
      context_label: "מיועד ראשון",
    });
  });

  test.afterAll(async () => {
    await deleteRoomsAmong(admin, [shadchanId, otherId]);
    await teardownShidduchFixtures(admin, fx);
  });

  test("שיחת כרטיס מציגה שורת הקשר, ושיחה כללית נשארת בלעדיה", async ({
    page,
  }) => {
    // Act
    await page.goto("/app");

    // Assert
    // הדשבורד מציג את רשימת השיחות ביותר מתצוגה אחת, ולכן נבדק המופע הראשון
    const studentCard = page
      .locator(`a[href="/app/chats/${studentRoom}"]`)
      .first();
    const generalCard = page
      .locator(`a[href="/app/chats/${generalRoom}"]`)
      .first();
    await expect(studentCard.locator('[data-slot="chat-context"]')).toHaveText(
      "כרטיס: מיועד ראשון",
    );
    await expect(generalCard).toBeVisible();
    await expect(generalCard.locator('[data-slot="chat-context"]')).toHaveCount(
      0,
    );
  });
});
