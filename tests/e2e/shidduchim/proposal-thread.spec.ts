import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  CARD_MANAGER_EMAIL,
  createCard,
  deleteRoomsAmong,
  ensureSecondParentId,
  insertProposal,
  pageAs,
  sendAs,
} from "../chats/context-fixtures";
import {
  createServiceClient,
  getTestUserId,
  setupShidduchFixtures,
  teardownShidduchFixtures,
  type ShidduchFixtures,
} from "./fixtures";

/**
 * שרשור ההצעה בעמוד ההצעה: לשדכן פאנל לכל צד שקיבל את ההצעה, ולהורה פאנל
 * מול השדכן. אותם הודעות כמו בצ'אט, עם קישור לפתיחה בצ'אט המלא.
 */
test.describe("שרשור הצעה בעמוד ההצעה", () => {
  test.describe.configure({ mode: "serial" });

  let admin: SupabaseClient;
  let fx: ShidduchFixtures;
  let shadchanId: string;
  let parentA: string;
  let parentB: string;
  let brideCard: string;
  let proposalId: string;
  let groomRoom: string;

  const everyone = () => [shadchanId, parentA, parentB];

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
      lastName: "לשרשור",
    });
    await deleteRoomsAmong(admin, everyone());
    proposalId = await insertProposal(admin, {
      groomId: fx.groomFirst,
      brideId: brideCard,
      shadchanId,
    });

    // חדר קיים רק מול צד החתן; מול צד הכלה עדיין אין שיחה
    const [userA, userB] = [shadchanId, parentA].sort();
    const { data, error } = await admin
      .from("chat_rooms")
      .insert({
        user_a: userA,
        user_b: userB,
        created_by: shadchanId,
        context_kind: "shidduch",
        shidduch_id: proposalId,
        context_label: "מיועד ראשון וכלה לשרשור",
      })
      .select("room_id")
      .single();
    if (error || !data) throw new Error(`יצירת חדר נכשלה: ${error?.message}`);
    groomRoom = data.room_id as string;
    await admin.from("chat_room_participants").insert([
      { room_id: groomRoom, user_id: shadchanId },
      { room_id: groomRoom, user_id: parentA },
    ]);
    await sendAs(admin, groomRoom, parentA, "שאלה מצד החתן לשדכן");
  });

  test.afterAll(async () => {
    await deleteRoomsAmong(admin, everyone());
    await admin.from("shidduchim").delete().eq("id", proposalId);
    await admin.from("students").delete().eq("id", brideCard);
    await teardownShidduchFixtures(admin, fx);
  });

  test("לשדכן: פאנל לכל צד, עם הודעות קיימות וקישור לצ'אט המלא", async ({
    page,
  }) => {
    await page.goto(`/app/shidduchim/${proposalId}`);

    const groomPanel = page.getByRole("region", { name: "שיחה עם צד החתן" });
    await expect(groomPanel.getByText("שאלה מצד החתן לשדכן")).toBeVisible();
    await expect(
      groomPanel.getByRole("link", { name: "פתיחה בצ'אט המלא" }),
    ).toHaveAttribute("href", `/app/chats/${groomRoom}`);

    const bridePanel = page.getByRole("region", { name: "שיחה עם צד הכלה" });
    await expect(
      bridePanel.getByRole("button", { name: "התחלת שיחה" }),
    ).toBeVisible();
  });

  test("לשדכן: התחלת שיחה מול צד הכלה ושליחת הודעה בפאנל", async ({ page }) => {
    await page.goto(`/app/shidduchim/${proposalId}`);

    const bridePanel = page.getByRole("region", { name: "שיחה עם צד הכלה" });
    await bridePanel.getByRole("button", { name: "התחלת שיחה" }).click();

    await bridePanel.getByLabel("הודעה חדשה").fill("שלום, נשמח לדבר על ההצעה");
    await bridePanel.getByRole("button", { name: "שליחת הודעה" }).click();
    await expect(
      bridePanel.getByText("שלום, נשמח לדבר על ההצעה"),
    ).toBeVisible();

    const { data: rooms } = await admin
      .from("chat_rooms")
      .select("room_id, context_kind, shidduch_id")
      .eq("shidduch_id", proposalId);
    expect(rooms).toHaveLength(2);
    expect(rooms?.every((r) => r.context_kind === "shidduch")).toBe(true);
  });

  test("להורה של צד הכלה: שרשור מול השדכן בלבד, בלי הודעות של צד החתן", async ({
    browser,
  }) => {
    // הורה ב' (צד הכלה) רואה רק את השרשור שלו מול השדכן
    const bridePage = await pageAs(
      browser,
      admin,
      "playwright-second-parent@kol-mitzhalot.test",
      `/app/shidduchim/${proposalId}`,
    );
    await expect(
      bridePage.getByRole("region", { name: "שיחה עם השדכן" }),
    ).toBeVisible();
    await expect(bridePage.getByText("שאלה מצד החתן לשדכן")).toHaveCount(0);
    await bridePage.context().close();
  });

  test("להורה: שרשור מול השדכן עם ההודעות, ופנייה מהירה פותחת את אותו חדר", async ({
    browser,
  }) => {
    const parentPage = await pageAs(
      browser,
      admin,
      CARD_MANAGER_EMAIL,
      `/app/shidduchim/${proposalId}`,
    );

    const panel = parentPage.getByRole("region", { name: "שיחה עם השדכן" });
    await expect(panel.getByText("שאלה מצד החתן לשדכן")).toBeVisible();
    await expect(
      panel.getByRole("link", { name: "פתיחה בצ'אט המלא" }),
    ).toHaveAttribute("href", `/app/chats/${groomRoom}`);

    // "שליחת הודעה לשדכן" כבר לא מוסיפה שורת הקשר בטקסט; ההודעה נכנסת לשרשור
    await parentPage.getByRole("button", { name: "שליחת הודעה לשדכן" }).click();
    const dialog = parentPage.getByRole("dialog", {
      name: "שליחת הודעה לשדכן",
    });
    await dialog.getByRole("textbox", { name: "הודעה" }).fill("שאלה נוספת");
    await dialog.getByRole("button", { name: "שליחה" }).click();
    await expect(parentPage).toHaveURL(new RegExp(`/app/chats/${groomRoom}`));

    const { data: messages } = await admin
      .from("chat_messages")
      .select("content")
      .eq("room_id", groomRoom)
      .eq("content", "שאלה נוספת");
    expect(messages).toHaveLength(1);
    await parentPage.context().close();
  });
});
