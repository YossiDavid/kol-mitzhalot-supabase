import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { clientAs, createCard } from "../chats/context-fixtures";
import {
  TEST_USER_EMAIL,
  createServiceClient,
  ensureCardManagerId,
  getTestUserId,
} from "../shidduchim/fixtures";
import { deleteCards } from "./third-party-card-fixtures";

/**
 * הערת שדכן/מנהל על כרטיס "בלעדי למנהל" אינה גלויה לשדכן אחר - לא ישירות
 * מהטבלה ולא דרך get_student_shadchan_notes. המנהל עדיין רואה אותה.
 */
const ADMIN_EMAIL =
  process.env.TEST_ADMIN_EMAIL ?? "playwright-admin@kol-mitzhalot.test";
const T = `${Date.now()}`.slice(-8);
const NOTE = `הערת מנהל על כרטיס בלעדי ${T}`;
let admin: SupabaseClient;
let cardId = "";

async function notesSeenBy(client: SupabaseClient) {
  const [direct, rpc] = await Promise.all([
    client.from("student_notes").select("body").eq("student_id", cardId),
    client.rpc("get_student_shadchan_notes", { p_student_id: cardId }),
  ]);
  return JSON.stringify([direct.data, rpc.data]);
}

test.describe("הערות שדכן על כרטיס בלעדי", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    admin = createServiceClient();
    const ownerId = await ensureCardManagerId(admin);
    const adminId = await getTestUserId(admin, ADMIN_EMAIL);
    cardId = await createCard(admin, {
      userId: ownerId,
      gender: "male",
      firstName: "בלעדי",
      lastName: `הערות${T}`,
    });
    const note = await admin.from("student_notes").insert({
      student_id: cardId,
      author_id: adminId,
      author_role: "admin",
      body: NOTE,
      is_private: false,
    });
    if (note.error) throw new Error(note.error.message);
    const exclusive = await admin
      .from("students")
      .update({ admin_exclusive_at: new Date().toISOString() })
      .eq("id", cardId);
    if (exclusive.error) throw new Error(exclusive.error.message);
  });

  test.afterAll(async () => {
    await admin.from("student_notes").delete().eq("student_id", cardId);
    await deleteCards(admin, [cardId]);
  });

  test("שדכן אחר לא רואה את ההערה, והמנהל רואה", async () => {
    // Arrange
    const shadchan = await clientAs(admin, TEST_USER_EMAIL);
    const adminUser = await clientAs(admin, ADMIN_EMAIL);

    // Act
    const [seenByShadchan, seenByAdmin] = await Promise.all([
      notesSeenBy(shadchan),
      notesSeenBy(adminUser),
    ]);

    // Assert
    expect(seenByShadchan).not.toContain(NOTE);
    expect(seenByAdmin).toContain(NOTE);
  });
});
