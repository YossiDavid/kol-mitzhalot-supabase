import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { CARD_MANAGER_EMAIL, clientAs } from "../chats/context-fixtures";
import {
  createServiceClient,
  deletePair,
  getTestUserId,
  setupShidduchFixtures,
  TEST_USER_EMAIL,
  teardownShidduchFixtures,
  type ShidduchFixtures,
} from "./fixtures";

/**
 * מדיניות ההכנסה / עדכון / מחיקה של shidduchim דרשה רק auth.uid() = shadchan_id,
 * בלי תפקיד: כל משתמש מחובר יכול היה ליצור הצעה על שמו (ולעקוף את נתיב
 * ה-offer ואת בדיקות התפקיד שבו). הבדיקות רצות בסשן אמיתי של "מנהל הכרטיסים"
 * (הורה בלי תפקיד שדכן) ושל משתמש הבדיקה (שדכן).
 */
test.describe("shidduchim - הכנסה עדכון ומחיקה דורשים תפקיד שדכן", () => {
  let admin: SupabaseClient;
  let fx: ShidduchFixtures;
  let plain: SupabaseClient;
  let shadchan: SupabaseClient;
  let shadchanId: string;

  test.beforeAll(async () => {
    admin = createServiceClient();
    fx = await setupShidduchFixtures(admin);
    shadchanId = await getTestUserId(admin);
    plain = await clientAs(admin, CARD_MANAGER_EMAIL);
    shadchan = await clientAs(admin, TEST_USER_EMAIL);
  });

  test.afterAll(async () => {
    await teardownShidduchFixtures(admin, fx);
  });

  const clean = () => deletePair(admin, fx.groomFirst, fx.brideFirst);
  test.beforeEach(clean);
  test.afterEach(clean);

  const countRows = async () => {
    const { count } = await admin
      .from("shidduchim")
      .select("id", { count: "exact", head: true })
      .eq("groom_id", fx.groomFirst)
      .eq("bride_id", fx.brideFirst);
    return count ?? 0;
  };

  test("משתמש בלי תפקיד לא יכול להכניס הצעה על שמו (טיוטה או נשלחה)", async () => {
    // Act
    const draft = await plain.from("shidduchim").insert({
      groom_id: fx.groomFirst,
      bride_id: fx.brideFirst,
      shadchan_id: fx.cardManagerId,
      status: "draft",
    });
    const sent = await plain.from("shidduchim").insert({
      groom_id: fx.groomFirst,
      bride_id: fx.brideFirst,
      shadchan_id: fx.cardManagerId,
      status: "sent",
      recipient_scope: "both",
    });

    // Assert
    expect(draft.error).not.toBeNull();
    expect(sent.error).not.toBeNull();
    expect(await countRows()).toBe(0);
  });

  test("בעל הצעה ישנה שאיבד את התפקיד לא יכול לעדכן אותה או למחוק אותה", async () => {
    // Arrange
    const { data: inserted } = await admin
      .from("shidduchim")
      .insert({
        groom_id: fx.groomFirst,
        bride_id: fx.brideFirst,
        shadchan_id: fx.cardManagerId,
        status: "draft",
        note_for_groom: "מקור",
      })
      .select("id")
      .single();

    // Act
    const updated = await plain
      .from("shidduchim")
      .update({ note_for_groom: "שונה" })
      .eq("id", inserted!.id)
      .select("id");
    const deleted = await plain
      .from("shidduchim")
      .delete()
      .eq("id", inserted!.id)
      .select("id");

    // Assert
    expect(updated.data ?? []).toHaveLength(0);
    expect(deleted.data ?? []).toHaveLength(0);
    expect(await countRows()).toBe(1);
  });

  test("שדכן אמיתי ממשיך ליצור, לעדכן ולמחוק את ההצעות שלו", async () => {
    // Act
    const created = await shadchan
      .from("shidduchim")
      .insert({
        groom_id: fx.groomFirst,
        bride_id: fx.brideFirst,
        shadchan_id: shadchanId,
        status: "draft",
      })
      .select("id")
      .single();
    const updated = await shadchan
      .from("shidduchim")
      .update({ note_for_bride: "עודכן" })
      .eq("id", created.data?.id ?? "")
      .select("id");
    const deleted = await shadchan
      .from("shidduchim")
      .delete()
      .eq("id", created.data?.id ?? "")
      .select("id");

    // Assert
    expect(created.error).toBeNull();
    expect(updated.data).toHaveLength(1);
    expect(deleted.data).toHaveLength(1);
  });
});
