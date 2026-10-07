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
  CARD_MANAGER_EMAIL,
  createCard,
  deleteRoomsAmong,
  ensureSecondParentId,
  insertProposal,
  pageAs,
} from "../chats/context-fixtures";

/**
 * בדשבורד של שדכן שהוא גם בעל כרטיס, כל חדר צ'אט מופיע באזור אחד בלבד:
 * "צ'אטים כשדכן" (כלי שדכן) או "הודעות משדכנים" (האזור האישי שלי).
 */
const SHADCHAN_CHATS = "צ'אטים כשדכן";
const PERSONAL_CHATS = "הודעות משדכנים";

// המקטע עצמו, לא האזור שעוטף אותו (גם הוא section)
const innermostSection = (page: Page) =>
  page.locator("section:not(:has(section))");

const chatSection = (page: Page, title: string): Locator =>
  innermostSection(page).filter({
    has: page.getByRole("heading", { level: 3, name: title, exact: true }),
  });

const roomLink = (scope: Page | Locator, roomId: string): Locator =>
  scope.locator(`a[href="/app/chats/${roomId}"]`);

type Context = Record<string, string | null>;

test.describe("דשבורד — אזורי שדכן ואזור אישי", () => {
  test.describe.configure({ mode: "serial" });

  let admin: SupabaseClient;
  let fx: ShidduchFixtures;
  let shadchanId: string;
  let parentId: string;
  let secondParentId: string;
  let ownCardId: string | null = null;
  const proposalIds: string[] = [];

  async function createRoom(
    otherId: string,
    context: Context,
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

  async function ownCardCount(): Promise<number> {
    const { count } = await admin
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("user_id", shadchanId);
    return count ?? 0;
  }

  async function cleanup() {
    const everyone = [shadchanId, parentId, secondParentId, fx.otherShadchanId];
    await deleteRoomsAmong(admin, everyone);
    if (proposalIds.length > 0) {
      await admin.from("shidduchim").delete().in("id", proposalIds);
    }
    if (ownCardId) await admin.from("students").delete().eq("id", ownCardId);
  }

  test.beforeAll(async () => {
    admin = createServiceClient();
    shadchanId = await getTestUserId(admin);
    fx = await setupShidduchFixtures(admin);
    parentId = fx.cardManagerId;
    secondParentId = await ensureSecondParentId(admin);
    await deleteRoomsAmong(admin, [
      shadchanId,
      parentId,
      secondParentId,
      fx.otherShadchanId,
    ]);
  });

  test.afterAll(async () => {
    await cleanup();
    await teardownShidduchFixtures(admin, fx);
  });

  test("שדכן בלי כרטיסים: האזור האישי מציג רק את מקטע הכרטיסים", async ({
    page,
  }) => {
    test.skip(
      (await ownCardCount()) > 0,
      "משתמש הבדיקה כבר מחזיק כרטיסים — אין מה לבדוק כאן",
    );

    // Act
    await page.goto("/app");

    // Assert
    await expect(
      page.getByRole("heading", { level: 2, name: "האזור האישי שלי" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 3, name: "הצעות פתוחות" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { level: 3, name: PERSONAL_CHATS }),
    ).toHaveCount(0);
    await expect(page.getByTestId("card-guidance-note")).toBeVisible();
  });

  test("כל חדר מופיע פעם אחת, באזור הנכון", async ({ page }) => {
    // Arrange
    ownCardId = await createCard(admin, {
      userId: shadchanId,
      gender: "female",
      firstName: "כרטיס",
      lastName: "שלי",
    });
    // הצעה ששלחתי כשדכן
    const sentByMe = await insertProposal(admin, {
      groomId: fx.groomFirst,
      brideId: fx.brideFirst,
      shadchanId,
    });
    // הצעה שנשלחה לכרטיס שלי על ידי שדכן אחר
    const sentToMe = await insertProposal(admin, {
      groomId: fx.groomSecond,
      brideId: ownCardId,
      shadchanId: fx.otherShadchanId,
    });
    proposalIds.push(sentByMe, sentToMe);

    const proposalISent = await createRoom(parentId, {
      context_kind: "shidduch",
      shidduch_id: sentByMe,
      context_label: "הצעה שלי",
    });
    const proposalToMyCard = await createRoom(fx.otherShadchanId, {
      context_kind: "shidduch",
      shidduch_id: sentToMe,
      context_label: "הצעה לכרטיס שלי",
    });
    const aboutMyCard = await createRoom(parentId, {
      context_kind: "student",
      student_id: ownCardId,
      context_label: "הכרטיס שלי",
    });
    const aboutOthersCard = await createRoom(secondParentId, {
      context_kind: "student",
      student_id: fx.groomSecond,
      context_label: "מיועד שני",
    });
    const general = await createRoom(secondParentId, {});

    // Act
    await page.goto("/app");

    // Assert
    await expect(
      page.getByRole("heading", { level: 2, name: "כלי שדכן" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: "האזור האישי שלי" }),
    ).toBeVisible();
    const shadchanChats = chatSection(page, SHADCHAN_CHATS);
    const personalChats = chatSection(page, PERSONAL_CHATS);
    await expect(shadchanChats).toBeVisible();

    for (const roomId of [proposalISent, aboutOthersCard, general]) {
      await expect(roomLink(shadchanChats, roomId)).toHaveCount(1);
      await expect(roomLink(personalChats, roomId)).toHaveCount(0);
      await expect(roomLink(page, roomId)).toHaveCount(1);
    }
    for (const roomId of [proposalToMyCard, aboutMyCard]) {
      await expect(roomLink(personalChats, roomId)).toHaveCount(1);
      await expect(roomLink(shadchanChats, roomId)).toHaveCount(0);
      await expect(roomLink(page, roomId)).toHaveCount(1);
    }
  });

  test("הורה רגיל: כל הצ'אטים במקטע אחד, בלי אזור שדכן", async ({
    browser,
  }) => {
    // Arrange: חדרים של ההורה מול השדכן, בהקשרים שונים
    const proposal = await insertProposal(admin, {
      groomId: fx.groomFirst,
      brideId: fx.brideSecond,
      shadchanId,
    });
    proposalIds.push(proposal);
    const proposalRoom = await createRoom(parentId, {
      context_kind: "shidduch",
      shidduch_id: proposal,
      context_label: "הצעה להורה",
    });
    const cardRoom = await createRoom(parentId, {
      context_kind: "student",
      student_id: fx.groomFirst,
      context_label: "מיועד ראשון",
    });
    const generalRoom = await createRoom(parentId, {});
    const page = await pageAs(browser, admin, CARD_MANAGER_EMAIL, "/app");

    try {
      // Assert
      await expect(
        page.getByRole("heading", { level: 2, name: "הודעות אחרונות" }),
      ).toBeVisible();
      await expect(page.getByRole("heading", { name: "כלי שדכן" })).toHaveCount(
        0,
      );
      await expect(
        page.getByRole("heading", { name: "האזור האישי שלי" }),
      ).toHaveCount(0);
      const chats = innermostSection(page).filter({
        has: page.getByRole("heading", { name: "הודעות אחרונות" }),
      });
      for (const roomId of [proposalRoom, cardRoom, generalRoom]) {
        await expect(roomLink(chats, roomId)).toHaveCount(1);
        await expect(roomLink(page, roomId)).toHaveCount(1);
      }
    } finally {
      await page.context().close();
    }
  });
});
