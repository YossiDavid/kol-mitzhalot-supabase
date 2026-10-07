import {
  test,
  expect,
  request as playwrightRequest,
  type APIRequestContext,
  type Page,
  type Request,
} from "@playwright/test";

import { BLOCKED_RESPONSE_MESSAGE } from "../../../features/students/lib/save-error-message";
import {
  createCard,
  ensureSecondParentId,
  pageAs,
} from "../chats/context-fixtures";
import {
  createServiceClient,
  ensureCardManagerId,
} from "../shidduchim/fixtures";

/**
 * שמירת כרטיס עוברת דרך השרת שלנו: הדפדפן לא קורא ל-RPC של Supabase. הסיבה:
 * סינון אינטרנט אצל משתמשות החליף את תשובת Supabase בדף HTML, והשמירה נכשלה
 * עם SyntaxError. כאן מדמים את החסימה, ובודקים גם את הנתיבים עצמם.
 */

const admin = createServiceClient();
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const CREATE_ENDPOINT = "/api/v1/students";
const updateEndpoint = (studentId: string) =>
  `/api/v1/students/${studentId}/profile`;
const RPC_URL_PATTERN = "**/rest/v1/rpc/**";
const CREATE_RPC = /\/rest\/v1\/rpc\/create_full_student_profile/;
const STUDENT_URL_ID = /\/app\/students\/([a-f0-9-]{36})/;
const FILTER_HTML = "<html><head></head><body>blocked</body></html>";
const SAVE_TIMEOUT_MS = 20_000;
const SLOW_TEST_TIMEOUT_MS = 90_000;
// מעל תקרת הגוף של הנתיב (256KB)
const OVERSIZE_BYTES = 300 * 1024;
const RUN_ID = Date.now();

const createdStudentIds: string[] = [];

const fill = (page: Page, fieldName: string, value: string) =>
  page.locator(`#${fieldName.replace(/[^a-zA-Z0-9]+/g, "-")}`).fill(value);

const next = (page: Page) => page.locator("button:has-text('הבא')").click();

/** ממלא את אשף היצירה עד השלב האחרון, בלי ללחוץ על השליחה */
async function fillCreateWizard(page: Page, lastName: string) {
  await page.goto("/app/students/create");
  await page.getByRole("radio", { name: "עבור בני או בתי" }).check();
  await page.getByRole("radio", { name: "מיועד", exact: true }).click();
  await next(page);

  await fill(page, "firstName", "שרת");
  await fill(page, "lastName", lastName);
  await fill(page, "country", "ישראל");
  await fill(page, "city", "בני ברק");
  await fill(page, "street", "רב שך");
  await fill(page, "house", "5");
  await page.locator('input[placeholder="בחר תאריך עברי"]').click();
  await page.locator(".grid-cols-7 button").first().click();
  const selects = page.locator("[data-slot='native-select']");
  await selects.nth(0).selectOption("single");
  await selects.nth(1).selectOption("kosher");
  await selects.nth(2).selectOption("koilel");
  await next(page);

  await expect(page.locator("button:has-text('הבא')")).toBeVisible();
  await next(page);

  await expect(page.locator("text=על המשפחה").first()).toBeVisible();
  await fill(page, "father.self", "אברהם");
  await fill(page, "father.phone", "0501234567");
  await fill(page, "father.job", "מלמד");
  await fill(page, "father.grandFather", "יצחק");
  await fill(page, "father.grandMother", "שרה");
  await fill(page, "mother.self", "רחל");
  await fill(page, "mother.maidenName", "לוי");
  await fill(page, "mother.phone", "0507654321");
  await fill(page, "mother.job", "מורה");
  await fill(page, "mother.grandFather", "יעקב");
  await fill(page, "mother.grandMother", "לאה");
  await fill(page, "family.numberOfChildren", "5");
  await fill(page, "family.currentChildPlace", "3");
  await fill(page, "family.about", "משפחה תורנית");
  await next(page);

  await expect(page.locator("button:has-text('הבא')")).toBeVisible();
  await next(page);
  await expect(page.locator("button:has-text('הבא')")).toBeVisible();
  await next(page);

  await expect(page.locator("button[type='submit']")).toBeVisible();
  await fill(page, "partner.additionalInformation", "מחפשים בן תורה");
  await fill(page, "author.name", "כותב");
  await fill(page, "author.phone", "0521234567");
  await fill(page, "author.relation", "אב");
}

async function findStudentsByLastName(lastName: string) {
  const { data, error } = await admin
    .from("students")
    .select("id, first_name")
    .eq("last_name", lastName);
  if (error) throw new Error(`חיפוש הכרטיס נכשל: ${error.message}`);
  return data ?? [];
}

function sameOriginHeaders() {
  return { Origin: BASE_URL, "Content-Type": "application/json" };
}

test.describe("שמירת כרטיס דרך השרת", () => {
  test.afterAll(async () => {
    if (createdStudentIds.length === 0) return;
    await admin.from("students").delete().in("id", createdStudentIds);
  });

  test("יצירה: הדפדפן לא שולח קריאת RPC ל-Supabase והכרטיס נוצר", async ({
    page,
  }) => {
    test.setTimeout(SLOW_TEST_TIMEOUT_MS);
    const lastName = `ללארפס${RUN_ID}`;
    const rpcRequests: Request[] = [];
    page.on("request", (request) => {
      if (CREATE_RPC.test(request.url())) rpcRequests.push(request);
    });
    const saveRequest = page.waitForRequest(
      (request) =>
        request.method() === "POST" && request.url().endsWith(CREATE_ENDPOINT),
    );

    await fillCreateWizard(page, lastName);
    await page.locator("button[type='submit']").click();

    await expect(page).toHaveURL(STUDENT_URL_ID, { timeout: SAVE_TIMEOUT_MS });
    createdStudentIds.push(page.url().match(STUDENT_URL_ID)?.[1] ?? "");
    expect(rpcRequests).toHaveLength(0);
    // תקרת הגוף (256KB) חייבת להיות הרבה מעל כרטיס אמיתי
    const bodyBytes = Buffer.byteLength((await saveRequest).postData() ?? "");
    expect(bodyBytes).toBeGreaterThan(0);
    expect(bodyBytes).toBeLessThan(50 * 1024);
    expect(await findStudentsByLastName(lastName)).toHaveLength(1);
  });

  test("סינון שמחליף תשובות RPC ב-HTML: יצירה ועריכה עדיין מצליחות", async ({
    page,
  }) => {
    test.setTimeout(SLOW_TEST_TIMEOUT_MS);
    const lastName = `מסנןחוסם${RUN_ID}`;
    await page.route(RPC_URL_PATTERN, (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: FILTER_HTML,
      }),
    );

    await fillCreateWizard(page, lastName);
    await page.locator("button[type='submit']").click();
    await expect(page).toHaveURL(STUDENT_URL_ID, { timeout: SAVE_TIMEOUT_MS });
    const studentId = page.url().match(STUDENT_URL_ID)?.[1] ?? "";
    createdStudentIds.push(studentId);

    await page.goto(`/app/students/${studentId}/edit`);
    await page
      .getByRole("navigation", { name: "שלבי הטופס" })
      .getByRole("button", { name: "פרטים אישיים", exact: true })
      .click();
    await page.locator("#street").fill("חזון איש");
    await page
      .getByRole("button", { name: "שמירת שינויים", exact: true })
      .click();

    await expect(page.getByText("השינויים נשמרו בהצלחה!").first()).toBeVisible({
      timeout: SAVE_TIMEOUT_MS,
    });
    const { data } = await admin
      .from("students")
      .select("street")
      .eq("id", studentId)
      .single();
    expect(data?.street).toBe("חזון איש");
  });

  test("הנתיב שלנו נחסם ב-HTML: הודעה ידידותית, בלי SyntaxError, בלי כרטיס", async ({
    page,
  }) => {
    test.setTimeout(SLOW_TEST_TIMEOUT_MS);
    const lastName = `נתיבחסום${RUN_ID}`;
    await page.route(`**${CREATE_ENDPOINT}`, (route) =>
      route.request().method() === "POST"
        ? route.fulfill({
            status: 200,
            contentType: "text/html",
            body: FILTER_HTML,
          })
        : route.fallback(),
    );

    await fillCreateWizard(page, lastName);
    await page.locator("button[type='submit']").click();

    await expect(page.getByText(BLOCKED_RESPONSE_MESSAGE).first()).toBeVisible({
      timeout: SAVE_TIMEOUT_MS,
    });
    await expect(page.getByText(/SyntaxError/)).toHaveCount(0);
    await expect(page).not.toHaveURL(STUDENT_URL_ID);
    expect(await findStudentsByLastName(lastName)).toHaveLength(0);
  });
});

test.describe("נתיבי שמירת הכרטיס", () => {
  const emptyPayload = { payload: {} };

  test("בלי התחברות: 401 ב-JSON", async () => {
    const anonymous = await playwrightRequest.newContext({
      baseURL: BASE_URL,
      storageState: { cookies: [], origins: [] },
    });
    try {
      const create = await anonymous.post(CREATE_ENDPOINT, {
        headers: sameOriginHeaders(),
        data: emptyPayload,
      });
      expect(create.status()).toBe(401);
      expect(create.headers()["content-type"]).toContain("application/json");

      const update = await anonymous.put(
        updateEndpoint("00000000-0000-4000-8000-000000000000"),
        { headers: sameOriginHeaders(), data: emptyPayload },
      );
      expect(update.status()).toBe(401);
    } finally {
      await anonymous.dispose();
    }
  });

  test("בקשה חוצת-אתר נדחית", async ({ request }) => {
    const crossOrigin = await request.post(CREATE_ENDPOINT, {
      headers: { Origin: "https://evil.example" },
      data: emptyPayload,
    });
    expect(crossOrigin.status()).toBe(403);

    const crossSite = await request.post(CREATE_ENDPOINT, {
      headers: { ...sameOriginHeaders(), "Sec-Fetch-Site": "cross-site" },
      data: emptyPayload,
    });
    expect(crossSite.status()).toBe(403);

    const noOriginAtAll = await request.post(CREATE_ENDPOINT, {
      data: emptyPayload,
    });
    expect(noOriginAtAll.status()).toBe(403);
  });

  test("גוף שאינו אובייקט נדחה ב-400, וגוף ענק ב-413", async ({ request }) => {
    const notAnObject = await request.post(CREATE_ENDPOINT, {
      headers: sameOriginHeaders(),
      data: "[]",
    });
    expect(notAnObject.status()).toBe(400);

    const payloadNotObject = await request.post(CREATE_ENDPOINT, {
      headers: sameOriginHeaders(),
      data: { payload: "x" },
    });
    expect(payloadNotObject.status()).toBe(400);

    const notJson = await request.post(CREATE_ENDPOINT, {
      headers: sameOriginHeaders(),
      data: "{not json",
    });
    expect(notJson.status()).toBe(400);

    const oversize = await request.post(CREATE_ENDPOINT, {
      headers: sameOriginHeaders(),
      data: { payload: { about: "x".repeat(OVERSIZE_BYTES) } },
    });
    expect(oversize.status()).toBe(413);
    expect(((await oversize.json()) as { error: string }).error).toBeTruthy();
  });

  test("משתמש שאינו הבעלים (ולא שדכן) לא יכול לערוך כרטיס של אחר", async ({
    browser,
  }) => {
    test.setTimeout(SLOW_TEST_TIMEOUT_MS);
    const ownerId = await ensureCardManagerId(admin);
    const studentId = await createCard(admin, {
      userId: ownerId,
      gender: "male",
      firstName: "בעלות",
      lastName: `לאשלך${RUN_ID}`,
    });
    createdStudentIds.push(studentId);
    await ensureSecondParentId(admin);

    const outsider = await pageAs(
      browser,
      admin,
      "playwright-second-parent@kol-mitzhalot.test",
      "/app",
    );
    try {
      const response: Awaited<ReturnType<APIRequestContext["put"]>> =
        await outsider.request.put(updateEndpoint(studentId), {
          headers: sameOriginHeaders(),
          data: { payload: { first_name: "פולש", last_name: "פולש" } },
        });

      expect(response.status()).toBe(403);
      const { data } = await admin
        .from("students")
        .select("first_name")
        .eq("id", studentId)
        .single();
      expect(data?.first_name).toBe("בעלות");
    } finally {
      await outsider.context().close();
    }
  });
});
