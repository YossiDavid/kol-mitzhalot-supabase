import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  CARD_MANAGER_EMAIL,
  clientAs,
  createCard,
  deleteRoomsAmong,
  ensureSecondParentId,
  insertProposal,
  openRoomAs,
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

    const groomPanel = page.getByRole("region", {
      name: "שיחה על ההצעה - עם צד החתן",
    });
    await expect(groomPanel.getByText("שאלה מצד החתן לשדכן")).toBeVisible();
    await expect(
      groomPanel.getByRole("link", { name: "פתיחה בצ'אט המלא" }),
    ).toHaveAttribute("href", `/app/chats/${groomRoom}`);

    // השדכן רואה את הכותרת הברורה, ובצד שעוד אין בו שיחה - שדה כתיבה גלוי
    await expect(
      groomPanel.getByRole("heading", { name: "שיחה על ההצעה" }),
    ).toBeVisible();
    const bridePanel = page.getByRole("region", {
      name: "שיחה על ההצעה - עם צד הכלה",
    });
    await expect(bridePanel.getByLabel("הודעה חדשה")).toBeVisible();
  });

  test("לשדכן: הודעה ראשונה מול צד הכלה יוצרת את השרשור ומופיעה בפאנל", async ({
    page,
  }) => {
    await page.goto(`/app/shidduchim/${proposalId}`);

    const bridePanel = page.getByRole("region", {
      name: "שיחה על ההצעה - עם צד הכלה",
    });
    await bridePanel.getByLabel("הודעה חדשה").fill("שלום, נשמח לדבר על ההצעה");
    await bridePanel.getByRole("button", { name: "שליחת הודעה" }).click();
    // הטקסט נמצא גם בשדה הכתיבה (React מעדכן את תוכנו), ולכן ממתינים לקישור
    // לצ'אט המלא: הוא מופיע רק אחרי שהחדר נוצר וההודעה נשלחה
    await expect(
      bridePanel.getByRole("link", { name: "פתיחה בצ'אט המלא" }),
    ).toBeVisible();
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
      bridePage.getByRole("region", { name: "שיחה על ההצעה - עם השדכן" }),
    ).toBeVisible();
    await expect(bridePage.getByText("שאלה מצד החתן לשדכן")).toHaveCount(0);
    await bridePage.context().close();
  });

  test("להורה: שרשור מול השדכן עם ההודעות, וקישור מהיר אליו בלי כפתור כפול", async ({
    browser,
  }) => {
    const parentPage = await pageAs(
      browser,
      admin,
      CARD_MANAGER_EMAIL,
      `/app/shidduchim/${proposalId}`,
    );

    const panel = parentPage.getByRole("region", {
      name: "שיחה על ההצעה - עם השדכן",
    });
    await expect(panel.getByText("שאלה מצד החתן לשדכן")).toBeVisible();
    await expect(
      panel.getByRole("link", { name: "פתיחה בצ'אט המלא" }),
    ).toHaveAttribute("href", `/app/chats/${groomRoom}`);

    // אין עוד כפתור פנייה נפרד: הכתיבה לשדכן היא בשרשור עצמו
    await expect(
      parentPage.getByRole("button", { name: "שליחת הודעה לשדכן" }),
    ).toHaveCount(0);
    await expect(
      parentPage.getByRole("link", { name: "לשיחה על ההצעה" }),
    ).toHaveAttribute("href", /#proposal-thread-/);

    await parentPage.context().close();
  });
  test("הודעה בשרשור מובילה בהתראה לעמוד ההצעה, בשני הכיוונים", async () => {
    // Act - ההורה כותב לשדכן, ואז השדכן עונה
    await sendAs(admin, groomRoom, parentA, "עדכון מההורה על ההצעה");
    await sendAs(admin, groomRoom, shadchanId, "תשובה מהשדכן על ההצעה");

    // Assert
    const { data: forShadchan } = await admin
      .from("notifications")
      .select("link, title")
      .eq("user_id", shadchanId)
      .eq("related_id", groomRoom)
      .eq("type", "chat_message")
      .single();
    expect(forShadchan?.link).toBe(
      `/app/shidduchim/${proposalId}#proposal-thread-${parentA}`,
    );
    expect(forShadchan?.title).toContain("הצעה");

    const { data: forParent } = await admin
      .from("notifications")
      .select("link, title")
      .eq("user_id", parentA)
      .eq("related_id", groomRoom)
      .eq("type", "chat_message")
      .single();
    expect(forParent?.link).toBe(
      `/app/shidduchim/${proposalId}#proposal-thread-${shadchanId}`,
    );
    expect(forParent?.title).toContain("הצעה");
  });

  test("רשימת ההצעות של ההורה: קישור לשיחה על ההצעה עם סימון לא נקרא", async ({
    browser,
  }) => {
    // Arrange - הודעה חדשה מהשדכן שההורה עוד לא קרא
    await sendAs(admin, groomRoom, shadchanId, "הודעה שלא נקראה");
    const parentPage = await pageAs(
      browser,
      admin,
      CARD_MANAGER_EMAIL,
      "/app/proposals",
    );

    // Act
    const link = parentPage.locator(
      `a[href^="/app/shidduchim/${proposalId}#"]`,
    );

    // Assert
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("data-unread", "true");
    await link.click();
    await expect(parentPage).toHaveURL(
      new RegExp(`/app/shidduchim/${proposalId}#proposal-thread-${shadchanId}`),
    );
    await expect(
      parentPage.getByRole("region", { name: "שיחה על ההצעה - עם השדכן" }),
    ).toBeInViewport();
    await parentPage.context().close();
  });

  test("אחרי שהצד השיב או שההצעה נדחתה השרשור נשאר פתוח לשני הכיוונים", async ({
    browser,
  }) => {
    // Arrange - תגובה "לא מעוניינים" וסטטוס נדחה
    await admin
      .from("shidduchim")
      .update({ status: "rejected" })
      .eq("id", proposalId);
    try {
      const parentClient = await clientAs(admin, CARD_MANAGER_EMAIL);

      // Act - פתיחת החדר מחדש מצד ההורה עדיין מותרת (הכללים אינם תלויים בסטטוס)
      const { roomId, error } = await openRoomAs(parentClient, shadchanId, {
        kind: "shidduch",
        shidduchId: proposalId,
      });
      expect(error).toBeNull();
      expect(roomId).toBe(groomRoom);

      // Assert - ושדה הכתיבה עדיין מוצג להורה
      const parentPage = await pageAs(
        browser,
        admin,
        CARD_MANAGER_EMAIL,
        `/app/shidduchim/${proposalId}`,
      );
      const panel = parentPage.getByRole("region", {
        name: "שיחה על ההצעה - עם השדכן",
      });
      await expect(panel.getByLabel("הודעה חדשה")).toBeVisible();
      await parentPage.context().close();
    } finally {
      await admin
        .from("shidduchim")
        .update({ status: "sent" })
        .eq("id", proposalId);
    }
  });
});
