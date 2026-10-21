import { expect, test } from "@playwright/test";

import { COMPLETE_IDENTITY_COLUMNS } from "../helpers/shadchan-form";
import { createServiceClient } from "../shidduchim/fixtures";

/**
 * עריכת פרופיל שדכן בידי מנהל (/app/admin/shadchanim/[id]/edit) ונתיב השרת
 * שלה: מנהל מתקן טקסט בלי לגעת בסטטוס; מי שאינו מנהל נדחה.
 */
const LOAD_TIMEOUT = 15_000;
const RUN_ID = Date.now();
const EMAIL = `admin-edit-target-${RUN_ID}@kol-mitzhalot.test`;
const ENDPOINT = "/api/v1/admin/shadchanim/update-profile";
const SEED_SUBMITTED_AT = "2020-04-01T10:00:00.000Z";
const SEED_BIO = "ביוגרפיה לפני תיקון מנהל";
const NEW_BIO = "ביוגרפיה אחרי תיקון מנהל";
const VALID_BODY = {
  bio: NEW_BIO,
  experience_years: "6",
  closed_matches: "4",
  specializations: "שידוכים צעירים",
  contact_phone: "0501234567",
  contact_email: "",
  languages: "עברית",
  community: "בעלזא",
  synagogue_rabbi: "הרב מתוקן",
  gender: COMPLETE_IDENTITY_COLUMNS.gender,
  birth_date: COMPLETE_IDENTITY_COLUMNS.birth_date,
  avatar_path: "",
  location: COMPLETE_IDENTITY_COLUMNS.location,
  match_types: [...COMPLETE_IDENTITY_COLUMNS.match_types],
  rabbi_phone: COMPLETE_IDENTITY_COLUMNS.rabbi_phone,
};

const service = createServiceClient();
let targetId = "";

test.beforeAll(async () => {
  const { data, error } = await service.auth.admin.createUser({
    email: EMAIL,
    phone: `+9725${String(RUN_ID).slice(-8)}`,
    email_confirm: true,
    phone_confirm: true,
    app_metadata: { roles: ["shadchan"] },
    user_metadata: {
      firstName: "יעד",
      lastName: "תיקון",
      phone_verified: true,
    },
  });
  if (error || !data.user) throw new Error(`יצירת שדכן: ${error?.message}`);
  targetId = data.user.id;
  await service
    .from("user_profiles")
    .upsert({ id: targetId, first_name: "יעד", last_name: "תיקון" });
  const { error: infoError } = await service.from("shadchanim_info").insert({
    user_id: targetId,
    application_status: "approved",
    submitted_at: SEED_SUBMITTED_AT,
    bio: SEED_BIO,
    experience_years: 5,
    closed_matches: 3,
    contact_phone: "0501234567",
    community: "בעלזא",
    synagogue_rabbi: "הרב מקורי",
    ...COMPLETE_IDENTITY_COLUMNS,
  });
  if (infoError) throw new Error(`שורת שדכן: ${infoError.message}`);
});

test.afterAll(async () => {
  await service.from("shadchanim_info").delete().eq("user_id", targetId);
  await service.auth.admin.deleteUser(targetId);
});

const rowOf = async () =>
  (
    await service
      .from("shadchanim_info")
      .select("bio, application_status, submitted_at")
      .eq("user_id", targetId)
      .single()
  ).data;

test.describe("עריכת פרופיל שדכן בידי מנהל", () => {
  test("מנהל מתקן טקסט דרך העמוד, והסטטוס ותאריך ההגשה נשארים", async ({
    page,
  }) => {
    // Arrange
    await page.goto(`/app/admin/shadchanim/${targetId}/edit`);
    await expect(page.getByLabel("ביוגרפיה")).toHaveValue(SEED_BIO, {
      timeout: LOAD_TIMEOUT,
    });

    // Act - ממלאים שוב עד שהערך נקלט: לפני ההידרציה הערך המוקלד נדרס
    await expect(async () => {
      await page.getByLabel("ביוגרפיה").fill(NEW_BIO);
      await expect(page.getByLabel("ביוגרפיה")).toHaveValue(NEW_BIO, {
        timeout: 1_000,
      });
    }).toPass({ timeout: LOAD_TIMEOUT });
    await page.getByRole("button", { name: "שמור שינויים" }).click();
    await expect(page).toHaveURL(/\/app\/admin\/shadchanim$/, {
      timeout: LOAD_TIMEOUT,
    });

    // Assert
    const row = await rowOf();
    expect(row?.bio).toBe(NEW_BIO);
    expect(row?.application_status).toBe("approved");
    expect(new Date(row?.submitted_at ?? "").toISOString()).toBe(
      SEED_SUBMITTED_AT,
    );
  });

  test("הנתיב מתעלם משדות סטטוס ודוחה גוף לא תקין", async ({ request }) => {
    // Act
    const withStatus = await request.post(ENDPOINT, {
      data: {
        ...VALID_BODY,
        userId: targetId,
        application_status: "rejected",
        submitted_at: "2026-01-01T00:00:00.000Z",
      },
    });
    const invalid = await request.post(ENDPOINT, {
      data: { ...VALID_BODY, userId: targetId, contact_phone: "12" },
    });

    // Assert
    expect(withStatus.status()).toBe(200);
    expect(invalid.status()).toBe(400);
    const row = await rowOf();
    expect(row?.application_status).toBe("approved");
    expect(new Date(row?.submitted_at ?? "").toISOString()).toBe(
      SEED_SUBMITTED_AT,
    );
  });

  test("הנתיב מחזיר 404 לשדכן שאין לו שורה", async ({ request }) => {
    // Act
    const response = await request.post(ENDPOINT, {
      data: { ...VALID_BODY, userId: "00000000-0000-4000-8000-000000000000" },
    });

    // Assert
    expect(response.status()).toBe(404);
  });
});

test.describe("נתיב עריכת הפרופיל - בלי הרשאת מנהל", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("בלי התחברות מקבלים 401", async ({ request }) => {
    const before = await rowOf();

    // Act
    const response = await request.post(ENDPOINT, {
      data: { ...VALID_BODY, bio: "פריצה", userId: targetId },
    });

    // Assert
    expect(response.status()).toBe(401);
    expect((await rowOf())?.bio).toBe(before?.bio);
  });

  test("שדכן רגיל מקבל 403 ולא משנה דבר", async ({ browser }) => {
    // Arrange - כניסה בדפדפן כשדכן המטרה עצמו (לא מנהל)
    const { data } = await service.auth.admin.generateLink({
      type: "magiclink",
      email: EMAIL,
    });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(
      `/auth/confirm?token_hash=${data?.properties?.hashed_token}&type=magiclink&next=/app`,
    );
    await page.getByRole("button", { name: "לחצו כדי להיכנס למערכת" }).click();
    await expect(page).toHaveURL((url) => url.pathname.startsWith("/app"), {
      timeout: LOAD_TIMEOUT,
    });
    const before = await rowOf();

    // Act
    const response = await context.request.post(ENDPOINT, {
      data: { ...VALID_BODY, bio: "פריצה", userId: targetId },
    });

    // Assert
    expect(response.status()).toBe(403);
    expect((await rowOf())?.bio).toBe(before?.bio);
    await context.close();
  });
});
