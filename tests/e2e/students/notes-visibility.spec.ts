import { test, expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  createServiceClient,
  setupShidduchFixtures,
  teardownShidduchFixtures,
  type ShidduchFixtures,
} from "../shidduchim/fixtures";

/**
 * "הערות שדכן" גלויות לכל השדכנים ולמנהלים, עם שם הכותב - ולאף אחד אחר:
 * לא לבעל הכרטיס, לא לאיש צוות ולא לצופה לא מחובר (קישור השיתוף).
 * "פידבק אנשי צוות" לא השתנה: גלוי לכל צופה, עם שם הכותב.
 *
 * הבדיקות ברמת הדפדפן מכסות שדכן ואנונימי; בעל הכרטיס ואיש הצוות נבדקים
 * ישירות מול ה-RLS בהתחברות כמשתמש, כי אין להם storageState בפרויקט.
 */
const admin = createServiceClient();
const STAFF_FEEDBACK = `מחמאה מאיש צוות ${Date.now()}`;
const OTHER_SHADCHAN_NOTE = `הערה של שדכן אחר ${Date.now()}`;
/** CARD_MANAGER ב-fixtures.ts - משמש כאן ככותב הפידבק ובעל הכרטיסים */
const STAFF_AUTHOR_NAME = "Fixture Manager";
/** OTHER_SHADCHAN ב-fixtures.ts */
const SHADCHAN_AUTHOR_NAME = "Fixture Shadchan";

const STAFF_VIEWER_EMAIL = "playwright-notes-staff-viewer@kol-mitzhalot.test";
const STAFF_VIEWER_PHONE = "+972500000012";
const CARD_MANAGER_EMAIL = "playwright-card-manager@kol-mitzhalot.test";

let fixtures: ShidduchFixtures;
let institutionId: string;
let staffViewerId: string;

async function insertNote(
  authorId: string,
  authorRole: "staff" | "shadchan",
  body: string,
): Promise<void> {
  const { error } = await admin.from("student_notes").insert({
    student_id: fixtures.groomFirst,
    author_id: authorId,
    author_role: authorRole,
    body,
  });
  if (error) throw new Error(`הכנת הערה לבדיקה נכשלה: ${error.message}`);
}

/** איש צוות מאושר במוסד של groomFirst - כך שרואה את הכרטיס עצמו */
async function setupStaffViewer(): Promise<void> {
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existing = users?.users.find((u) => u.email === STAFF_VIEWER_EMAIL);
  if (existing) {
    staffViewerId = existing.id;
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: STAFF_VIEWER_EMAIL,
      phone: STAFF_VIEWER_PHONE,
      email_confirm: true,
      phone_confirm: true,
      app_metadata: { roles: ["staff"] },
      user_metadata: {
        firstName: "Notes",
        lastName: "StaffViewer",
        phone: STAFF_VIEWER_PHONE,
        phone_verified: true,
      },
    });
    if (error || !data.user) {
      throw new Error(`יצירת איש צוות לבדיקה נכשלה: ${error?.message}`);
    }
    staffViewerId = data.user.id;
  }

  const { data: institution, error: institutionError } = await admin
    .from("institutions")
    .insert({
      name: `מוסד בדיקת הערות ${Date.now()}`,
      gender: "male",
      type: "yeshiva_gedola",
    })
    .select("id")
    .single();
  if (institutionError || !institution) {
    throw new Error(`יצירת מוסד לבדיקה נכשלה: ${institutionError?.message}`);
  }
  institutionId = institution.id;

  const { error: staffInfoError } = await admin.from("staff_info").upsert(
    {
      user_id: staffViewerId,
      institution_id: institutionId,
      application_status: "approved",
    },
    { onConflict: "user_id" },
  );
  if (staffInfoError) {
    throw new Error(`הכנת staff_info נכשלה: ${staffInfoError.message}`);
  }

  const { error: studentError } = await admin
    .from("students")
    .update({ institution_id: institutionId })
    .eq("id", fixtures.groomFirst);
  if (studentError) {
    throw new Error(`שיוך המיועד למוסד נכשל: ${studentError.message}`);
  }
}

/** לקוח מחובר כמשתמש (RLS חל), בלי סיסמה: magic link ואימות הטוקן */
async function signedInClient(email: string): Promise<SupabaseClient> {
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const tokenHash = link?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    throw new Error(`יצירת קישור כניסה נכשלה: ${linkError?.message}`);
  }

  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { error } = await client.auth.verifyOtp({
    token_hash: tokenHash,
    type: "magiclink",
  });
  if (error) throw new Error(`כניסה כ-${email} נכשלה: ${error.message}`);
  return client;
}

function anonymousClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/** מה שצופה רואה על הכרטיס: קריאה ישירה מהטבלה והפונקציות הייעודיות */
async function readNotesAs(client: SupabaseClient) {
  const [direct, shadchanNotes, staffFeedback] = await Promise.all([
    client
      .from("student_notes")
      .select("id, body, author_role")
      .eq("student_id", fixtures.groomFirst),
    client.rpc("get_student_shadchan_notes", {
      p_student_id: fixtures.groomFirst,
    }),
    client.rpc("get_student_staff_feedback", {
      p_student_id: fixtures.groomFirst,
    }),
  ]);
  return {
    directBodies: (direct.data ?? []).map((row) => row.body as string),
    shadchanNoteBodies: ((shadchanNotes.data ?? []) as { body: string }[]).map(
      (row) => row.body,
    ),
    staffFeedbackBodies: ((staffFeedback.data ?? []) as { body: string }[]).map(
      (row) => row.body,
    ),
  };
}

async function openCard(page: Page): Promise<void> {
  await page.goto(`/app/students/${fixtures.groomFirst}`);
  await expect(page.getByText("פידבק אנשי צוות").first()).toBeVisible({
    timeout: 15_000,
  });
}

test.beforeAll(async () => {
  fixtures = await setupShidduchFixtures(admin);
  await setupStaffViewer();
  await insertNote(fixtures.cardManagerId, "staff", STAFF_FEEDBACK);
  await insertNote(fixtures.otherShadchanId, "shadchan", OTHER_SHADCHAN_NOTE);
});

test.afterAll(async () => {
  // מחיקת המיועדים מוחקת את ההערות ב-cascade
  await teardownShidduchFixtures(admin, fixtures);
  await admin.from("staff_info").delete().eq("user_id", staffViewerId);
  await admin.from("institutions").delete().eq("id", institutionId);
});

test.describe("שדכן מחובר", () => {
  test("רואה הערה של שדכן אחר עם שם הכותב, פידבק צוות, וכותב הערה משלו", async ({
    page,
  }) => {
    // Arrange
    await openCard(page);

    // Assert - הערת שדכן אחר גלויה עם שם הכותב, אך בלי עריכה/מחיקה
    const othersItem = page
      .getByRole("listitem")
      .filter({ hasText: OTHER_SHADCHAN_NOTE });
    await expect(othersItem).toBeVisible();
    await expect(othersItem.getByText(SHADCHAN_AUTHOR_NAME)).toBeVisible();
    await expect(
      othersItem.getByRole("button", { name: "עריכת ההערה" }),
    ).toHaveCount(0);
    await expect(
      othersItem.getByRole("button", { name: "מחיקת ההערה" }),
    ).toHaveCount(0);
    await expect(
      page.getByText("גלוי לכל השדכנים ולמנהלי המערכת"),
    ).toBeVisible();

    // Assert - פידבק הצוות כמקודם
    await expect(page.getByText(STAFF_FEEDBACK)).toBeVisible();
    await expect(page.getByText(STAFF_AUTHOR_NAME)).toBeVisible();

    // Act - כתיבת הערה
    const myNote = `הערה שלי ${Date.now()}`;
    const composer = page.getByPlaceholder(
      "הערה על המיועד/ת, גלויה לשדכנים...",
    );
    await composer.fill(myNote);
    await page.getByRole("button", { name: "שמירת הערה" }).click();

    // Assert - ממתינים לפריט ברשימה (ולא לטקסט שעדיין בתיבה) לפני בדיקת המסד
    const myItem = page.getByRole("listitem").filter({ hasText: myNote });
    await expect(myItem).toBeVisible({ timeout: 10_000 });
    await expect(composer).toHaveValue("");
    await expect(
      myItem.getByRole("button", { name: "עריכת ההערה" }),
    ).toBeVisible();
    const { data, error } = await admin
      .from("student_notes")
      .select("author_role, author_id")
      .eq("student_id", fixtures.groomFirst)
      .eq("body", myNote)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data?.author_role).toBe("shadchan");

    // Act - עריכה ומחיקה של ההערה שלי
    await myItem.getByRole("button", { name: "עריכת ההערה" }).click();
    const edited = `${myNote} (נערך)`;
    await page.getByLabel("עריכת הערה").fill(edited);
    await page.getByRole("button", { name: "שמירה", exact: true }).click();
    const editedItem = page.getByRole("listitem").filter({ hasText: edited });
    await expect(editedItem).toBeVisible({ timeout: 10_000 });

    page.once("dialog", (dialog) => dialog.accept());
    await editedItem.getByRole("button", { name: "מחיקת ההערה" }).click();
    await expect(editedItem).toHaveCount(0);
  });

  test("שדכן אינו יכול לערוך הערה של שדכן אחר דרך ה-API", async ({
    request,
  }) => {
    // Arrange
    const { data: note } = await admin
      .from("student_notes")
      .select("id")
      .eq("student_id", fixtures.groomFirst)
      .eq("body", OTHER_SHADCHAN_NOTE)
      .single();

    // Act
    const res = await request.patch(
      `/api/v1/students/${fixtures.groomFirst}/notes/${note?.id}`,
      { data: { body: "ניסיון עריכה" } },
    );

    // Assert
    expect(res.status()).toBe(404);
    const { data: after } = await admin
      .from("student_notes")
      .select("body")
      .eq("id", note?.id)
      .single();
    expect(after?.body).toBe(OTHER_SHADCHAN_NOTE);
  });
});

test.describe("צופה לא מחובר (קישור שיתוף)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("רואה את פידבק הצוות ולא רואה הערות שדכן", async ({ page }) => {
    // Arrange + Act
    await openCard(page);

    // Assert
    await expect(page.getByText(STAFF_FEEDBACK)).toBeVisible();
    await expect(page.getByText(STAFF_AUTHOR_NAME)).toBeVisible();
    await expect(page.getByText(OTHER_SHADCHAN_NOTE)).toHaveCount(0);
    await expect(page.getByText("הערות שדכן")).toHaveCount(0);
  });

  test("ה-RLS וה-RPC אינם מחזירים הערות שדכן לאנונימי", async () => {
    // Arrange + Act
    const seen = await readNotesAs(anonymousClient());

    // Assert
    expect(seen.directBodies).toEqual([]);
    expect(seen.shadchanNoteBodies).toEqual([]);
    expect(seen.staffFeedbackBodies).toContain(STAFF_FEEDBACK);
  });
});

test.describe("בעל הכרטיס ואיש צוות (ברמת ה-RLS)", () => {
  test("בעל הכרטיס אינו רואה הערות שדכן, אך רואה פידבק צוות", async () => {
    // Arrange
    const owner = await signedInClient(CARD_MANAGER_EMAIL);

    // Act
    const seen = await readNotesAs(owner);

    // Assert - הפידבק הוא שלו (כותב), הערת השדכן לא גלויה לו
    expect(seen.directBodies).not.toContain(OTHER_SHADCHAN_NOTE);
    expect(seen.shadchanNoteBodies).toEqual([]);
    expect(seen.staffFeedbackBodies).toContain(STAFF_FEEDBACK);
  });

  test("איש צוות במוסד של המיועד אינו רואה הערות שדכן ואינו רואה פידבק של אחר ישירות", async () => {
    // Arrange
    const staff = await signedInClient(STAFF_VIEWER_EMAIL);

    // Act
    const seen = await readNotesAs(staff);

    // Assert
    expect(seen.directBodies).toEqual([]);
    expect(seen.shadchanNoteBodies).toEqual([]);
    expect(seen.staffFeedbackBodies).toContain(STAFF_FEEDBACK);
  });

  test("שדכן אחר אינו רואה ישירות פידבק צוות של אחר - רק דרך הפונקציה", async () => {
    // Arrange
    const shadchan = await signedInClient(
      process.env.TEST_USER_EMAIL ?? "playwright-test@kol-mitzhalot.test",
    );

    // Act
    const seen = await readNotesAs(shadchan);

    // Assert
    expect(seen.directBodies).toContain(OTHER_SHADCHAN_NOTE);
    expect(seen.directBodies).not.toContain(STAFF_FEEDBACK);
    expect(seen.shadchanNoteBodies).toContain(OTHER_SHADCHAN_NOTE);
    expect(seen.staffFeedbackBodies).toContain(STAFF_FEEDBACK);
  });
});
