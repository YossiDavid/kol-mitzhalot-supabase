import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import {
  clientAs,
  createCard,
  ensureSecondParentId,
  insertProposal,
} from "../chats/context-fixtures";
import {
  TEST_USER_EMAIL,
  createServiceClient,
  ensureCardManagerId,
  getTestUserId,
} from "./fixtures";
import { deleteCards } from "../students/third-party-card-fixtures";

/**
 * החלטות מוצר (4.11.2026):
 * - גישת "הצעה" לכרטיס רק בהצעה פתוחה (לא אחרי דחייה / סגירה)
 * - שדכן מוסיף ומסדר תמונות, אבל לא מוחק
 * - שדכן אינו עורך כרטיס צד שלישי מוגבל
 */
const SECOND_PARENT_EMAIL = "playwright-second-parent@kol-mitzhalot.test";
const T = `${Date.now()}`.slice(-8);
let admin: SupabaseClient;
let shadchanId = "";
let ownerId = "";
const cards: string[] = [];

async function card(gender: "male" | "female", userId = ownerId) {
  const id = await createCard(admin, {
    userId,
    gender,
    firstName: gender === "male" ? "חתן" : "כלה",
    lastName: `החלטות${T}`,
  });
  cards.push(id);
  return id;
}

async function accessLevel(client: SupabaseClient, sid: string) {
  const { data, error } = await client.rpc("get_student_card_access", { sid });
  expect(error, error?.message).toBeNull();
  return (data as { access_level: string }[])[0]?.access_level;
}

test.describe("החלטות מוצר - הרשאות", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    admin = createServiceClient();
    shadchanId = await getTestUserId(admin);
    ownerId = await ensureCardManagerId(admin);
  });

  test.afterAll(async () => {
    await admin.from("shidduchim").delete().in("groom_id", cards);
    await admin.from("student_photos").delete().in("student_id", cards);
    await deleteCards(admin, cards);
  });

  test("הצד השני מאבד גישה לכרטיס אחרי דחייה וסגירה", async () => {
    // Arrange
    const parentId = await ensureSecondParentId(admin);
    const groomId = await card("male");
    const brideId = await card("female", parentId);
    const proposalId = await insertProposal(admin, {
      groomId,
      brideId,
      shadchanId,
    });
    const otherSide = await clientAs(admin, SECOND_PARENT_EMAIL);

    // Act + Assert
    expect(await accessLevel(otherSide, groomId)).toBe("proposal");
    for (const status of ["rejected", "completed"]) {
      await admin.from("shidduchim").update({ status }).eq("id", proposalId);
      expect(await accessLevel(otherSide, groomId), status).toBe("none");
    }
  });

  test("שדכן מסדר תמונות אבל לא מוחק", async () => {
    // Arrange
    const groomId = await card("male");
    const paths = [0, 1].map((i) => `${groomId}/photos/decision-${i}.png`);
    const { error } = await admin.from("student_photos").insert(
      paths.map((storage_path, position) => ({
        student_id: groomId,
        storage_path,
        position,
      })),
    );
    expect(error, error?.message).toBeNull();
    const shadchan = await clientAs(admin, TEST_USER_EMAIL);

    // Act
    const reorder = await shadchan.rpc("set_student_photos", {
      p_student_id: groomId,
      p_paths: [...paths].reverse(),
    });
    const remove = await shadchan.rpc("set_student_photos", {
      p_student_id: groomId,
      p_paths: [paths[0]],
    });

    // Assert
    expect(reorder.error, reorder.error?.message).toBeNull();
    expect(remove.error?.message).toBe("not_allowed");
    const { count } = await admin
      .from("student_photos")
      .select("*", { count: "exact", head: true })
      .eq("student_id", groomId);
    expect(count).toBe(2);
  });

  test("שדכן אינו עורך כרטיס צד שלישי מוגבל", async () => {
    // Arrange
    const restrictedId = await card("male");
    await admin
      .from("students")
      .update({ card_for: "other" })
      .eq("id", restrictedId);
    const shadchan = await clientAs(admin, TEST_USER_EMAIL);

    // Act
    const { error } = await shadchan.rpc("update_full_student_profile", {
      p_student_id: restrictedId,
      payload: { first_name: "נדרס" },
    });

    // Assert
    expect(error?.message).toBe("not_allowed");
  });
});
