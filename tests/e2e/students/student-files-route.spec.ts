import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createCard,
  ensureSecondParentId,
  insertProposal,
  pageAs,
} from "../chats/context-fixtures";
import {
  TEST_USER_EMAIL,
  createServiceClient,
  ensureCardManagerId,
  getTestUserId,
} from "../shidduchim/fixtures";
import { deleteCards } from "./third-party-card-fixtures";

/**
 * קו"ח: במסד נשמר נתיב, והקישור נחתם לכמה דקות בכל צפייה דרך
 * /api/v1/students/[id]/files/cv - רק למי שרשאי לראות אותו.
 */
const SECOND_PARENT_EMAIL = "playwright-second-parent@kol-mitzhalot.test";
const T = `${Date.now()}`.slice(-8);
let admin: SupabaseClient;
let groomId = "";
let brideId = "";
let proposalId = "";
let cvPath = "";

const cvRoute = () => `/api/v1/students/${groomId}/files/cv`;

test.describe("נתיב הקבצים של כרטיס", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    admin = createServiceClient();
    const shadchanId = await getTestUserId(admin);
    const ownerId = await ensureCardManagerId(admin);
    const parentId = await ensureSecondParentId(admin);
    groomId = await createCard(admin, {
      userId: ownerId,
      gender: "male",
      firstName: "קובץ",
      lastName: `נתיב${T}`,
    });
    brideId = await createCard(admin, {
      userId: parentId,
      gender: "female",
      firstName: "כלה",
      lastName: `נתיב${T}`,
    });
    cvPath = `${groomId}/${T}-cv.pdf`;
    const upload = await admin.storage
      .from("students")
      .upload(cvPath, new Blob(["%PDF-1.4"], { type: "application/pdf" }));
    if (upload.error) throw new Error(upload.error.message);
    await admin.from("students").update({ cv_url: cvPath }).eq("id", groomId);
    proposalId = await insertProposal(admin, { groomId, brideId, shadchanId });
  });

  test.afterAll(async () => {
    await admin.storage.from("students").remove([cvPath]);
    await admin.from("shidduchim").delete().eq("id", proposalId);
    await deleteCards(admin, [groomId, brideId]);
  });

  test("שדכן מקבל הפניה לקישור חתום קצר", async ({ browser }) => {
    // Arrange
    const page = await pageAs(browser, admin, TEST_USER_EMAIL, "/app");

    // Act
    const response = await page.request.get(cvRoute(), { maxRedirects: 0 });

    // Assert
    expect(response.status()).toBe(302);
    expect(response.headers()["location"]).toContain("token=");
    expect(response.headers()["cache-control"]).toContain("no-store");
    await page.context().close();
  });

  test('הצד השני מקבל את הקובץ רק כשהשדכן שיתף קו"ח', async ({ browser }) => {
    // Arrange
    const page = await pageAs(browser, admin, SECOND_PARENT_EMAIL, "/app");

    // Act + Assert: בלי שיתוף
    await admin
      .from("shidduchim")
      .update({ share_cv: false })
      .eq("id", proposalId);
    const hidden = await page.request.get(cvRoute(), { maxRedirects: 0 });
    expect(hidden.status()).toBe(404);

    // Act + Assert: עם שיתוף
    await admin
      .from("shidduchim")
      .update({ share_cv: true })
      .eq("id", proposalId);
    const shared = await page.request.get(cvRoute(), { maxRedirects: 0 });
    expect(shared.status()).toBe(302);
    await page.context().close();
  });

  test("גולש לא מחובר לא מקבל את הקובץ", async ({ playwright }) => {
    // Arrange
    const anonymous = await playwright.request.newContext({
      baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
      storageState: { cookies: [], origins: [] },
    });

    // Act
    const response = await anonymous.get(cvRoute(), { maxRedirects: 0 });

    // Assert
    expect(response.status()).not.toBe(302);
    await anonymous.dispose();
  });

  test("אי אפשר לשמור ב-cv_url קישור לאתר חיצוני", async () => {
    const { error } = await admin
      .from("students")
      .update({ cv_url: "https://evil.example/cv.pdf" })
      .eq("id", groomId);
    expect(error?.message).toContain("invalid_student_file_path");
  });
});
