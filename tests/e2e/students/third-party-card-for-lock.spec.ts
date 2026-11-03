import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import {
  CARD_MANAGER_EMAIL,
  clientAs,
  createCard,
} from "../chats/context-fixtures";
import {
  createServiceClient,
  ensureCardManagerId,
} from "../shidduchim/fixtures";
import { deleteCards } from "./third-party-card-fixtures";

/**
 * כרטיס צד שלישי לא יוצא מ-'other' בלי שני אישורי ההנהלה: אחרת ממלא הכרטיס
 * עוקף את אישור התצוגה המלאה ואת אישור ההצעות.
 */
const T = `${Date.now()}`.slice(-8);
let admin: SupabaseClient;
let cardId = "";

test.describe("נעילת card_for בכרטיס צד שלישי", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    admin = createServiceClient();
    const ownerId = await ensureCardManagerId(admin);
    cardId = await createCard(admin, {
      userId: ownerId,
      gender: "male",
      firstName: "צד",
      lastName: `שלישי${T}`,
    });
    const { error } = await admin
      .from("students")
      .update({ card_for: "other" })
      .eq("id", cardId);
    if (error) throw new Error(error.message);
  });

  test.afterAll(async () => {
    await deleteCards(admin, [cardId]);
  });

  test("ממלא הכרטיס לא משנה את card_for, ומנהל כן", async () => {
    // Arrange
    const owner = await clientAs(admin, CARD_MANAGER_EMAIL);

    // Act
    const byOwner = await owner
      .from("students")
      .update({ card_for: "child" })
      .eq("id", cardId);
    const afterOwner = await admin
      .from("students")
      .select("card_for")
      .eq("id", cardId)
      .single();

    // Assert
    expect(byOwner.error?.message).toContain("third_party_card_for_locked");
    expect(afterOwner.data?.card_for).toBe("other");

    // מנהל (service role) רשאי
    const byAdmin = await admin
      .from("students")
      .update({ card_for: "child" })
      .eq("id", cardId);
    expect(byAdmin.error).toBeNull();
  });
});
