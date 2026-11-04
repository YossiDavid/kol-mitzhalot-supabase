import { expect, test } from "@playwright/test";

import { clientAs, createCard } from "../chats/context-fixtures";
import {
  TEST_USER_EMAIL,
  createServiceClient,
  ensureCardManagerId,
} from "../shidduchim/fixtures";
import { deleteCards } from "./third-party-card-fixtures";

/** לימודים ותעסוקה של כרטיס צד שלישי מוגבל אינם קריאים לשדכן ישירות */
test("שדכן לא קורא לימודים ותעסוקה של כרטיס צד שלישי מוגבל", async () => {
  // Arrange
  const svc = createServiceClient();
  const ownerId = await ensureCardManagerId(svc);
  const id = await createCard(svc, {
    userId: ownerId,
    gender: "male",
    firstName: "מוגבל",
    lastName: `היסטוריה${Date.now()}`,
  });
  await svc.from("education_history").insert({ student_id: id, name: "ישיבה" });
  await svc
    .from("employment_history")
    .insert({ student_id: id, role: "תפקיד" });
  await svc.from("students").update({ card_for: "other" }).eq("id", id);
  const shadchan = await clientAs(svc, TEST_USER_EMAIL);

  // Act
  const [education, employment] = await Promise.all([
    shadchan.from("education_history").select("id").eq("student_id", id),
    shadchan.from("employment_history").select("id").eq("student_id", id),
  ]);

  // Assert
  expect(education.data).toEqual([]);
  expect(employment.data).toEqual([]);
  await deleteCards(svc, [id]);
});
