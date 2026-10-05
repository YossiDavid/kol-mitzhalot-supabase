import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { clientAs } from "../chats/context-fixtures";
import {
  createServiceClient,
  deletePair,
  getTestUserId,
  insertShidduch,
  setupShidduchFixtures,
  teardownShidduchFixtures,
  TEST_USER_EMAIL,
  type ShidduchFixtures,
} from "../shidduchim/fixtures";

const OTHER_SHADCHAN_EMAIL = "playwright-other-shadchan@kol-mitzhalot.test";
const SENDER_DAILY_MAX = 20;
const PERMISSION_DENIED = "42501";
const LIMIT_REACHED = "54000";

/**
 * send_shidduch_closed_notice נקראת ב-RPC ישירות (JWT אמיתי), כדי לבדוק את
 * שתי המגבלות שנאכפות במסד בלבד: דרישת תפקיד שדכן/מנהל בתוקף, ותקרה של 20
 * הודעות ביממה לשולח. שורות ההודעות לתקרה נזרעות ישירות.
 */
test.describe("הודעת הצעה שירדה — תפקיד ותקרה יומית", () => {
  test.describe.configure({ mode: "serial" });

  let admin: SupabaseClient;
  let shadchanId: string;
  let fx: ShidduchFixtures;

  test.beforeAll(async () => {
    admin = createServiceClient();
    shadchanId = await getTestUserId(admin);
    fx = await setupShidduchFixtures(admin);
  });

  test.afterAll(async () => {
    await teardownShidduchFixtures(admin, fx);
  });

  const cleanPairs = async () => {
    await deletePair(admin, fx.groomFirst, fx.brideFirst);
    await deletePair(admin, fx.groomSecond, fx.brideSecond);
    await deletePair(admin, fx.groomFirst, fx.brideSecond);
  };
  test.beforeEach(cleanPairs);
  test.afterEach(cleanPairs);

  async function insertRejectedBoth(
    groomId: string,
    brideId: string,
    ownerId: string,
  ): Promise<string> {
    const id = await insertShidduch(admin, {
      groomId,
      brideId,
      shadchanId: ownerId,
    });
    const { error } = await admin
      .from("shidduchim")
      .update({
        status: "rejected",
        recipient_scope: "both",
        sent_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw new Error(`סימון הצעה כנדחתה נכשל: ${error.message}`);
    return id;
  }

  async function countNotices(shidduchId: string): Promise<number> {
    const { count } = await admin
      .from("shidduch_closed_notices")
      .select("id", { count: "exact", head: true })
      .eq("shidduch_id", shidduchId);
    return count ?? 0;
  }

  test("משתמש בלי תפקיד שדכן לא יכול לשלוח, גם כשהוא בעל ההצעה", async () => {
    // Arrange - ההצעה רשומה על משתמש שאינו שדכן (למשל שדכן שהוסר מהתפקיד)
    const id = await insertRejectedBoth(
      fx.groomFirst,
      fx.brideFirst,
      fx.otherShadchanId,
    );
    const roleless = await clientAs(admin, OTHER_SHADCHAN_EMAIL);

    // Act
    const { error } = await roleless.rpc("send_shidduch_closed_notice", {
      p_shidduch_id: id,
      p_side: "groom",
      p_message: "הצעה שירדה",
    });

    // Assert
    expect(error?.code).toBe(PERMISSION_DENIED);
    expect(error?.message).toContain("shadchan_role_required");
    expect(await countNotices(id)).toBe(0);
  });

  test("שדכן בתפקיד תקף שולח את אותה הודעה בהצלחה", async () => {
    // Arrange
    const id = await insertRejectedBoth(
      fx.groomFirst,
      fx.brideFirst,
      shadchanId,
    );
    const shadchan = await clientAs(admin, TEST_USER_EMAIL);

    // Act
    const { error } = await shadchan.rpc("send_shidduch_closed_notice", {
      p_shidduch_id: id,
      p_side: "groom",
      p_message: "הצעה שירדה",
    });

    // Assert
    expect(error).toBeNull();
    expect(await countNotices(id)).toBe(1);
  });

  test("התקרה: אחרי 20 הודעות ביממה ההודעה ה-21 נדחית, וחלון ישן לא נספר", async () => {
    // Arrange - 20 הודעות קיימות של השדכן (על הצעה אחרת), ועוד אחת ישנה
    const seedProposal = await insertRejectedBoth(
      fx.groomSecond,
      fx.brideSecond,
      shadchanId,
    );
    const target = await insertRejectedBoth(
      fx.groomFirst,
      fx.brideFirst,
      shadchanId,
    );
    const now = Date.now();
    const recentNotices = Array.from({ length: SENDER_DAILY_MAX }, () => ({
      shidduch_id: seedProposal,
      side: "bride",
      message: "הודעה קודמת",
      sent_by: shadchanId,
      recipient_user_id: fx.cardManagerId,
      created_at: new Date(now - 60 * 60 * 1000).toISOString(),
    }));
    const { error: seedError } = await admin
      .from("shidduch_closed_notices")
      .insert(recentNotices);
    if (seedError) throw new Error(`זריעת הודעות נכשלה: ${seedError.message}`);
    const shadchan = await clientAs(admin, TEST_USER_EMAIL);

    // Act
    const { error } = await shadchan.rpc("send_shidduch_closed_notice", {
      p_shidduch_id: target,
      p_side: "groom",
      p_message: "הודעה מעבר לתקרה",
    });

    // Assert
    expect(error?.code).toBe(LIMIT_REACHED);
    expect(error?.message).toContain("daily_limit_reached");
    expect(await countNotices(target)).toBe(0);

    // Arrange - אחת מהן יוצאת מחלון 24 השעות: נשארו 19, ולכן שליחה מצליחה
    const { data: oldest } = await admin
      .from("shidduch_closed_notices")
      .select("id")
      .eq("shidduch_id", seedProposal)
      .limit(1)
      .single();
    await admin
      .from("shidduch_closed_notices")
      .update({ created_at: new Date(now - 25 * 60 * 60 * 1000).toISOString() })
      .eq("id", oldest!.id);

    // Act
    const { error: afterWindow } = await shadchan.rpc(
      "send_shidduch_closed_notice",
      {
        p_shidduch_id: target,
        p_side: "groom",
        p_message: "הודעה אחרי שהחלון התפנה",
      },
    );

    // Assert
    expect(afterWindow).toBeNull();
    expect(await countNotices(target)).toBe(1);
  });
});
