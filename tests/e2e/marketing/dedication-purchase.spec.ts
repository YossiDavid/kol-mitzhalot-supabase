/**
 * Callers: Playwright `marketing` project (ללא התחברות).
 * רכישת פרנס היום / השבוע / החודש: מינימום התרומה (101), מחירים והצעת הרכישה
 * (בדיקות יחידה), כוונת התרומה בשרת (סכום נעול למחיר, משבצת תפוסה, תקופה מהשרת),
 * יצירת ההקדשה בתשלום מאושר דרך record_nedarim_payment (פורסמה, אי-התאמה, כפילות,
 * עסקה זמנית, משבצת שנתפסה בינתיים), וה-webhook החתום שמציג אותה באתר מיד
 * (מדלג כשבשרת אין NEDARIM_WEBHOOK_SECRET). טופס הרכישה בדף התרומות מדלג כשאין
 * בשרת הגדרת נדרים פלוס (כמו marketing/donations.spec.ts).
 * מחירי הפרנס במסד נשמרים לפני הריצה ומוחזרים בסופה.
 */
import { randomUUID } from "node:crypto";
import { test, expect, type APIRequestContext } from "@playwright/test";

import { hebrewMonthRange } from "@/features/dedications/lib/dedication-defaults";
import {
  DEDICATION_PRICE_INVALID_MESSAGE,
  buildDedicationOffer,
  dedicationPricesFormSchema,
  dedicationPurchaseHref,
  parseSponsorKindParam,
  splitPriceChanges,
  toDedicationPrices,
  toPricesFormValues,
} from "@/features/dedications/lib/dedication-prices";
import { israelWeekRange } from "@/features/dedications/lib/israel-date";
import {
  AMOUNT_PRESETS,
  DEFAULT_PRESET_AMOUNT,
  NO_DEDICATION,
  PURCHASE_MESSAGES,
  validateDonationForm,
  validateDonationFormClient,
  type DonationFormValues,
} from "@/features/donations/lib/donation-form";
import {
  toDonationInsert,
  validateDonationIntent,
} from "@/features/donations/lib/intent";
import {
  DONATION_AMOUNT_MIN,
  isValidDonationAmount,
} from "@/features/donations/lib/nedarim";
import {
  computeSignature,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
} from "@/features/donations/lib/verify-webhook";
import { buildStartPaymentValue } from "@/features/donations/lib/start-payment";
import {
  addDays,
  deleteDedicationsByPrefix,
  israelToday,
  seedDedications,
  serviceClient,
} from "../helpers/dedications";
import {
  installReactJsxRuntime,
  renderToHtml,
} from "../helpers/render-component";

const RUN = `buy${Date.now()}${Math.floor(Math.random() * 1000)}`;
const INTENT = "/api/v1/donations/intent";
const CALLBACK = "/api/v1/donations/nedarim-callback";
const SECRET = process.env.NEDARIM_WEBHOOK_SECRET || "playwright-test-secret";
const DAY_PRICE = 360;
const WEEK_PRICE = 1800;
const today = israelToday();
/** כתובת IP משלה לריצה: מגבלת הכוונות (20 ל-10 דקות) לא נשחקת בין ריצות */
const IP_HEADERS = {
  "x-forwarded-for": `10.77.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
};

const db = serviceClient();
const donationIds: string[] = [];
let savedPrices: { kind: string; amount: number }[] = [];

const honoree = (name: string) => `${name} ${RUN}`;

async function setPrices(rows: { kind: string; amount: number }[]) {
  await db.from("dedication_prices").delete().neq("kind", "");
  if (rows.length > 0) {
    const { error } = await db.from("dedication_prices").insert(rows);
    expect(error).toBeNull();
  }
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const { data } = await db.from("dedication_prices").select("kind, amount");
  savedPrices = data ?? [];
  await setPrices([
    { kind: "sponsor_day", amount: DAY_PRICE },
    { kind: "sponsor_week", amount: WEEK_PRICE },
  ]);
});

test.afterAll(async () => {
  await deleteDedicationsByPrefix(RUN);
  await db.from("donation_payments").delete().like("raw->>RunTag", `${RUN}%`);
  if (donationIds.length > 0) {
    await db.from("dedications").delete().in("donation_id", donationIds);
    await db.from("donations").delete().in("id", donationIds);
  }
  await setPrices(savedPrices);
});

// ═══ מינימום תרומה ═══════════════════════════════════════════════════

test.describe("מינימום תרומה 101 ₪", () => {
  test("המינימום 101, וכל ההצעות הקבועות לפחות המינימום; ברירת המחדל 180", () => {
    expect(DONATION_AMOUNT_MIN).toBe(101);
    expect(AMOUNT_PRESETS.every((preset) => preset >= 101)).toBe(true);
    expect(AMOUNT_PRESETS).toContain(DEFAULT_PRESET_AMOUNT);
    expect(DEFAULT_PRESET_AMOUNT).toBe(180);
    expect(isValidDonationAmount(100)).toBe(false);
    expect(isValidDonationAmount(101)).toBe(true);
  });

  test("טופס, StartPayment ושרת דוחים 100 ומקבלים 101", async ({ request }) => {
    const values = {
      presetAmount: null,
      customAmount: "100",
      dedicationType: NO_DEDICATION,
      dedicationName: "",
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
    };
    expect(validateDonationForm(values).amount).toContain("101");
    expect(
      validateDonationForm({ ...values, customAmount: "101" }).amount,
    ).toBeUndefined();
    const base = {
      mosadId: "1234567",
      apiValid: "x",
      frequency: "once" as const,
    };
    expect(buildStartPaymentValue({ ...base, amount: 100 })).toBeNull();
    expect(buildStartPaymentValue({ ...base, amount: 101 })?.Amount).toBe(
      "101",
    );

    const rejected = await request.post(INTENT, {
      headers: IP_HEADERS,
      data: { amount: 100, frequency: "once", firstName: honoree("min") },
    });
    expect(rejected.status()).toBe(400);
    expect((await rejected.json()).error).toContain("101");
  });
});

// ═══ מחירים והצעה (יחידה) ════════════════════════════════════════════

test.describe("מחירי פרנס והצעת רכישה", () => {
  test("פרמטר הכתובת: רק סוגי פרנס; הקישור כולל את הסוג ואת העוגן", () => {
    expect(parseSponsorKindParam("sponsor_week")).toBe("sponsor_week");
    expect(parseSponsorKindParam(["sponsor_day", "x"])).toBe("sponsor_day");
    for (const junk of ["memorial", "", undefined, "SPONSOR_DAY"]) {
      expect(parseSponsorKindParam(junk)).toBeNull();
    }
    expect(dedicationPurchaseHref("sponsor_day")).toBe(
      "/donations?dedication=sponsor_day#donate",
    );
  });

  test("מחירים לא תקינים או סוג לא מוכר נזרקים; בלי מחיר אין הצעה", () => {
    const prices = toDedicationPrices([
      { kind: "sponsor_day", amount: 360 },
      { kind: "sponsor_week", amount: 50 },
      { kind: "memorial", amount: 500 },
      { kind: "sponsor_month", amount: "1000" },
    ]);
    expect(prices).toEqual({ sponsor_day: 360, sponsor_month: 1000 });
    expect(buildDedicationOffer("sponsor_week", prices, today)).toBeNull();
  });

  test("התקופה: יום = היום, שבוע = ראשון עד שבת, חודש = החודש העברי", () => {
    const prices = { sponsor_day: 1, sponsor_week: 2, sponsor_month: 3 };
    expect(buildDedicationOffer("sponsor_day", prices, today)).toMatchObject({
      label: "פרנס היום",
      amount: 1,
      startsOn: today,
      endsOn: today,
    });
    const week = israelWeekRange(today);
    expect(buildDedicationOffer("sponsor_week", prices, today)).toMatchObject({
      startsOn: week.start,
      endsOn: week.end,
    });
    const month = hebrewMonthRange(today);
    expect(buildDedicationOffer("sponsor_month", prices, today)).toMatchObject({
      startsOn: month.starts_on,
      endsOn: month.ends_on,
    });
  });

  test("טופס המחירים בניהול: ריק = ללא רכישה, מתחת למינימום או לא מספר נדחה", () => {
    const valid = dedicationPricesFormSchema.safeParse({
      sponsor_day: " 360 ",
      sponsor_week: "",
      sponsor_month: "101",
    });
    expect(valid.success).toBe(true);
    expect(splitPriceChanges(valid.data!)).toEqual({
      upserts: [
        { kind: "sponsor_month", amount: 101 },
        { kind: "sponsor_day", amount: 360 },
      ],
      deletes: ["sponsor_week"],
    });
    for (const bad of ["100", "abc", "12.5", "50001"]) {
      const parsed = dedicationPricesFormSchema.safeParse({
        sponsor_day: bad,
        sponsor_week: "",
        sponsor_month: "",
      });
      expect(parsed.success, bad).toBe(false);
      expect(parsed.error?.issues[0].message).toBe(
        DEDICATION_PRICE_INVALID_MESSAGE,
      );
    }
    expect(toPricesFormValues({ sponsor_week: 1800 })).toEqual({
      sponsor_day: "",
      sponsor_week: "1800",
      sponsor_month: "",
    });
  });

  test("ברכישה: הקדשה, שם פרטי ושם משפחה חובה; הוראת קבע נדחית בשרת", () => {
    const values: DonationFormValues = {
      presetAmount: DAY_PRICE,
      customAmount: "",
      dedicationType: NO_DEDICATION,
      dedicationName: "",
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      donorId: "",
    };
    expect(validateDonationFormClient(values, "once")).toEqual({});
    expect(validateDonationFormClient(values, "once", true)).toEqual({
      dedicationName: PURCHASE_MESSAGES.dedicationRequired,
      firstName: PURCHASE_MESSAGES.firstNameRequired,
      lastName: PURCHASE_MESSAGES.lastNameRequired,
    });

    const intent = {
      amount: DAY_PRICE,
      frequency: "once",
      dedicationKind: "sponsor_day",
      dedicationType: "לעילוי נשמת",
      dedicationName: "משה בן שרה",
      firstName: "ישראל",
      lastName: "ישראלי",
    };
    const ok = validateDonationIntent(intent);
    expect(ok.ok).toBe(true);
    expect(validateDonationIntent({ ...intent, frequency: "monthly" }).ok).toBe(
      false,
    );
    expect(validateDonationIntent({ ...intent, lastName: "" }).ok).toBe(false);
    expect(
      validateDonationIntent({ ...intent, dedicationKind: "memorial" }).ok,
    ).toBe(false);

    if (!ok.ok) return;
    expect(
      toDonationInsert(ok.data, { starts_on: today, ends_on: today }),
    ).toMatchObject({
      frequency: "one_time",
      dedication_kind: "sponsor_day",
      dedication_starts_on: today,
      dedication_ends_on: today,
      dedication_text: "לעילוי נשמת משה בן שרה",
    });
    // תרומה רגילה: בלי עמודות פרנס גם אם הועברה תקופה
    const { dedicationKind: _omit, ...plain } = ok.data;
    void _omit;
    expect(
      toDonationInsert(plain, { starts_on: today, ends_on: today }),
    ).toMatchObject({ dedication_kind: null, dedication_starts_on: null });
  });
});

// ═══ כוונת תרומה בשרת ════════════════════════════════════════════════

function purchaseIntent(overrides: Record<string, unknown> = {}) {
  return {
    amount: DAY_PRICE,
    frequency: "once",
    dedicationKind: "sponsor_day",
    dedicationType: "לעילוי נשמת",
    dedicationName: honoree("משה בן שרה"),
    firstName: "ישראל",
    lastName: RUN,
    ...overrides,
  };
}

async function donationsByRun() {
  const { data } = await db
    .from("donations")
    .select("*")
    .eq("donor_last_name", RUN);
  return data ?? [];
}

test.describe("כוונת רכישה בשרת", () => {
  test("סכום שונה מהמחיר, סוג בלי מחיר או הוראת קבע: 400 ולא נוצרת שורה", async ({
    request,
  }) => {
    const before = (await donationsByRun()).length;
    const cases = [
      { data: purchaseIntent({ amount: DAY_PRICE - 1 }), text: "360" },
      { data: purchaseIntent({ amount: 101 }), text: "360" },
      {
        data: purchaseIntent({ dedicationKind: "sponsor_month" }),
        text: "אינו זמין",
      },
      { data: purchaseIntent({ frequency: "monthly" }), text: "" },
      { data: purchaseIntent({ firstName: "" }), text: "שם פרטי" },
    ];
    for (const { data, text } of cases) {
      const response = await request.post(INTENT, {
        headers: IP_HEADERS,
        data,
      });
      expect(response.status(), JSON.stringify(data)).toBe(400);
      expect((await response.json()).error).toContain(text);
    }
    expect(await donationsByRun()).toHaveLength(before);
  });

  test("סכום המחיר: 201, והשורה נושאת את הסוג והתקופה שנקבעו בשרת", async ({
    request,
  }) => {
    const response = await request.post(INTENT, {
      headers: IP_HEADERS,
      // תקופה מהלקוח מתעלמים ממנה
      data: purchaseIntent({
        dedicationKind: "sponsor_week",
        amount: WEEK_PRICE,
        dedication_starts_on: "2020-01-01",
      }),
    });
    expect(response.status()).toBe(201);
    const { id } = await response.json();
    donationIds.push(id);
    const week = israelWeekRange(today);
    const { data: row } = await db
      .from("donations")
      .select("*")
      .eq("id", id)
      .single();
    expect(row).toMatchObject({
      status: "pending",
      amount: WEEK_PRICE,
      frequency: "one_time",
      dedication_kind: "sponsor_week",
      dedication_starts_on: week.start,
      dedication_ends_on: week.end,
      dedication_type: "לעילוי נשמת",
    });
  });

  test("משבצת עם הקדשה מפורסמת חופפת: 409; לא מפורסמת אינה חוסמת", async ({
    request,
  }) => {
    const [hiddenId] = await seedDedications([
      {
        kind: "sponsor_day",
        honoree: honoree("טיוטה"),
        starts_on: today,
        ends_on: today,
        is_published: false,
      },
    ]);
    const allowed = await request.post(INTENT, {
      headers: IP_HEADERS,
      data: purchaseIntent(),
    });
    expect(allowed.status()).toBe(201);
    donationIds.push((await allowed.json()).id);

    await db
      .from("dedications")
      .update({ is_published: true })
      .eq("id", hiddenId);
    const taken = await request.post(INTENT, {
      headers: IP_HEADERS,
      data: purchaseIntent(),
    });
    expect(taken.status()).toBe(409);
    expect((await taken.json()).error).toContain("כבר הוקדש");
    await db.from("dedications").delete().eq("id", hiddenId);
  });
});

// ═══ יצירת ההקדשה בתשלום מאושר (record_nedarim_payment) ═══════════════

async function seedPurchase(
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const { data, error } = await db
    .from("donations")
    .insert({
      amount: DAY_PRICE,
      frequency: "one_time",
      dedication_type: "לרפואת",
      dedication_name: honoree("שרה בת רבקה"),
      dedication_text: `לרפואת ${honoree("שרה בת רבקה")}`,
      donor_first_name: "אבי",
      donor_last_name: "כהן",
      dedication_kind: "sponsor_day",
      dedication_starts_on: today,
      dedication_ends_on: today,
      ...overrides,
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  donationIds.push(data!.id);
  return data!.id as string;
}

function recordPayment(
  donationId: string,
  fields: {
    amount?: number;
    transactionId?: string;
    isTemporary?: boolean;
  } = {},
) {
  return db.rpc("record_nedarim_payment", {
    p_kind: "transaction",
    p_transaction_id: fields.transactionId ?? `${RUN}-${randomUUID()}`,
    p_keva_id: null,
    p_param2: donationId,
    p_amount: fields.amount ?? DAY_PRICE,
    p_currency: 1,
    p_confirmation: fields.isTemporary ? null : "0123456",
    p_last4: "4242",
    p_transaction_time: null,
    p_raw: { RunTag: RUN },
    p_is_temporary: fields.isTemporary ?? false,
  });
}

async function dedicationsOf(donationId: string) {
  const { data } = await db
    .from("dedications")
    .select("*")
    .eq("donation_id", donationId);
  return data ?? [];
}

test.describe("הקדשה מתשלום מאושר", () => {
  test("paid יוצר הקדשה מפורסמת אחת; שליחה חוזרת אינה יוצרת שנייה", async () => {
    const id = await seedPurchase();
    const transactionId = `${RUN}-${randomUUID()}`;
    const { data, error } = await recordPayment(id, { transactionId });
    expect(error).toBeNull();
    expect(data).toMatchObject({ status: "paid", matched: true });

    const [dedication, ...rest] = await dedicationsOf(id);
    expect(rest).toHaveLength(0);
    expect(dedication).toMatchObject({
      kind: "sponsor_day",
      dedication_type: "לרפואת",
      honoree: honoree("שרה בת רבקה"),
      donor_line: "אבי כהן",
      starts_on: today,
      ends_on: today,
      is_published: true,
      needs_review: false,
    });

    const replay = await recordPayment(id, { transactionId });
    expect(replay.data).toMatchObject({ duplicate: true });
    expect(await dedicationsOf(id)).toHaveLength(1);
    await db.from("dedications").delete().eq("donation_id", id);
  });

  test("סכום שונה מהמחיר (iframe ששונה): mismatch ובלי הקדשה", async () => {
    const id = await seedPurchase();
    const { data } = await recordPayment(id, { amount: 101 });
    expect(data).toMatchObject({ status: "mismatch", matched: false });
    expect(await dedicationsOf(id)).toHaveLength(0);
  });

  test("עסקה זמנית: אין הקדשה עד העדכון המאשר", async () => {
    const id = await seedPurchase();
    const transactionId = `${RUN}-${randomUUID()}`;
    await recordPayment(id, { transactionId, isTemporary: true });
    expect(await dedicationsOf(id)).toHaveLength(0);

    const { data } = await recordPayment(id, { transactionId });
    expect(data).toMatchObject({ status: "paid" });
    expect(await dedicationsOf(id)).toHaveLength(1);
    await db.from("dedications").delete().eq("donation_id", id);
  });

  test("המשבצת נתפסה בינתיים: התשלום נרשם, וההקדשה לא מפורסמת ומסומנת לבדיקה", async () => {
    const [blockerId] = await seedDedications([
      {
        kind: "sponsor_day",
        honoree: honoree("קודם"),
        starts_on: today,
        ends_on: today,
      },
    ]);
    const id = await seedPurchase();
    const { data } = await recordPayment(id);
    expect(data).toMatchObject({ status: "paid", matched: true });
    const [dedication] = await dedicationsOf(id);
    expect(dedication).toMatchObject({
      is_published: false,
      needs_review: true,
    });
    await db.from("dedications").delete().in("id", [blockerId, dedication.id]);
  });

  test("תרומה רגילה ששולמה אינה יוצרת הקדשה", async () => {
    const id = await seedPurchase({
      dedication_kind: null,
      dedication_starts_on: null,
      dedication_ends_on: null,
    });
    await recordPayment(id);
    expect(await dedicationsOf(id)).toHaveLength(0);
  });
});

// ═══ webhook חתום ← מופיע באתר מיד ════════════════════════════════════

function postCallback(
  request: APIRequestContext,
  body: Record<string, unknown>,
) {
  const raw = JSON.stringify(body);
  const timestamp = String(Math.floor(Date.now() / 1000));
  return request.post(CALLBACK, {
    headers: {
      "Content-Type": "application/json",
      [TIMESTAMP_HEADER]: timestamp,
      [SIGNATURE_HEADER]: computeSignature(SECRET, timestamp, raw),
    },
    data: Buffer.from(raw),
  });
}

test.describe("webhook: הקדשה באתר מיד (דורש NEDARIM_WEBHOOK_SECRET בשרת)", () => {
  test.beforeAll(async ({ playwright, baseURL }) => {
    const request = await playwright.request.newContext({ baseURL });
    const probe = await postCallback(request, { RunTag: RUN });
    await request.dispose();
    test.skip(
      probe.status() === 401,
      "NEDARIM_WEBHOOK_SECRET לא מוגדר בשרת הזה - בדיקות הקליטה מדלגות",
    );
  });

  test("עסקה מאושרת: ההקדשה מופיעה בקובייה בדף הבית בטעינה הבאה; mismatch לא", async ({
    page,
    request,
  }) => {
    // טוענים קודם כדי שהקוביות (בלי ההקדשה) יישמרו בקאש: ההופעה מוכיחה הפקעת תג
    await page.goto("/");
    const id = await seedPurchase();
    const response = await postCallback(request, {
      TransactionId: `${RUN}-${randomUUID()}`,
      Amount: String(DAY_PRICE),
      Currency: "1",
      Confirmation: "0123456",
      Param2: id,
      RunTag: RUN,
    });
    expect(response.status()).toBe(200);
    expect((await response.json()).WEBDocID).toEqual(expect.any(Number));

    await page.goto("/");
    await expect(
      page.locator("#dedication-tiles").getByText(honoree("שרה בת רבקה")),
    ).toBeVisible();
    await db.from("dedications").delete().eq("donation_id", id);

    const mismatchId = await seedPurchase();
    await postCallback(request, {
      TransactionId: `${RUN}-${randomUUID()}`,
      Amount: "101",
      Currency: "1",
      Confirmation: "0123456",
      Param2: mismatchId,
      RunTag: RUN,
    });
    expect(await dedicationsOf(mismatchId)).toHaveLength(0);
  });
});

// ═══ טופס הרכישה בדף התרומות ═════════════════════════════════════════

test.describe("טופס רכישת פרנס בדף התרומות", () => {
  test("?dedication=sponsor_day: כותרת עם המחיר, בלי בחירת סכום ותדירות, והכוונה נשלחת עם הסוג והמחיר", async ({
    page,
  }) => {
    let intentBody: Record<string, unknown> | null = null;
    await page.route("**/api/v1/donations/intent", async (route) => {
      intentBody = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        json: { id: randomUUID(), callbackUrl: null },
      });
    });
    await page.route("https://www.matara.pro/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<html></html>",
      }),
    );
    // המחיר נקרא מהקאש של האתר; בפיתוח הוא עשוי להיות ישן עד דקה אחרי שינוי ישיר במסד
    await page.goto("/donations?dedication=sponsor_day#donate");
    test.skip(
      (await page.getByRole("button", { name: /המשך לתשלום/ }).count()) === 0,
      "משתני הסביבה של נדרים פלוס לא מוגדרים בשרת - אין טופס",
    );

    const offer = page.getByTestId("dedication-offer");
    await expect(offer).toContainText(`פרנס היום – ${DAY_PRICE} ₪`);
    await expect(page.getByText("הוראת קבע חודשית")).toHaveCount(0);
    await expect(page.getByLabel("סכום אחר (בש״ח)")).toHaveCount(0);

    await page.getByRole("button", { name: /המשך לתשלום/ }).click();
    await expect(
      page.getByText(PURCHASE_MESSAGES.firstNameRequired),
    ).toBeVisible();
    expect(intentBody).toBeNull();

    await page.getByLabel("שם", { exact: true }).fill("משה בן שרה");
    await page.getByLabel("שם פרטי").fill("ישראל");
    await page.getByLabel("שם משפחה").fill("ישראלי");
    await page.getByRole("button", { name: /המשך לתשלום/ }).click();
    await expect.poll(() => intentBody).not.toBeNull();
    expect(intentBody).toMatchObject({
      amount: DAY_PRICE,
      frequency: "once",
      dedicationKind: "sponsor_day",
      dedicationType: "לעילוי נשמת",
      dedicationName: "משה בן שרה",
    });
  });

  test("סוג לא מוכר מתעלמים ממנו: טופס רגיל", async ({ page }) => {
    await page.goto(`/donations?dedication=memorial&x=${addDays(today, 0)}`);
    await expect(page.getByTestId("dedication-offer")).toHaveCount(0);
    await expect(page.getByTestId("dedication-offer-unavailable")).toHaveCount(
      0,
    );
  });
});

// ═══ רינדור רכיבים (בלי הגדרת נדרים פלוס בשרת) ══════════════════════

test.describe("רינדור: טופס רכישה, תודה וקוביות עם מחיר", () => {
  test.beforeAll(() => {
    installReactJsxRuntime();
  });

  const offer = {
    kind: "sponsor_day" as const,
    label: "פרנס היום",
    amount: DAY_PRICE,
    startsOn: today,
    endsOn: today,
  };

  test("טופס במצב רכישה: כותרת עם המחיר, בלי סכומים ותדירות, הקדשה בלי 'ללא הקדשה'", async () => {
    const { DonationForm } =
      await import("../../../components/website/donations/donation-form");
    const props = { mosadId: "1234567", apiValid: "x", onContinue: () => {} };
    const html = renderToHtml(DonationForm, { ...props, offer });
    expect(html).toContain('data-testid="dedication-offer"');
    expect(html).toContain(`פרנס היום – ${DAY_PRICE} ₪`);
    expect(html).not.toContain('name="donation-preset"');
    expect(html).not.toContain('name="donation-frequency"');
    expect(html).not.toContain("ללא הקדשה");
    expect(html).toContain("(חובה, תופיע באתר)");

    const plain = renderToHtml(DonationForm, props);
    expect(plain).not.toContain('data-testid="dedication-offer"');
    expect(plain).toContain('value="101"');
    expect(plain).not.toContain('value="36"');
    // ברירת המחדל: 180 מסומן
    expect(plain).toMatch(/value="180"[^>]*checked|checked[^>]*value="180"/);
  });

  test("תודה אחרי רכישה: 'ההנצחה שלך תופיע באתר' וקישור לדף הבית", async () => {
    const { DonationThanks, DEDICATION_THANKS_TEXT } =
      await import("../../../components/website/donations/donation-thanks");
    const props = {
      confirmation: "processing" as const,
      onAnotherDonation: () => {},
    };
    const html = renderToHtml(DonationThanks, {
      ...props,
      isDedicationPurchase: true,
    });
    expect(html).toContain(DEDICATION_THANKS_TEXT);
    expect(DEDICATION_THANKS_TEXT).toBe("ההנצחה שלך תופיע באתר");
    expect(html).toContain('href="/"');
    expect(renderToHtml(DonationThanks, props)).not.toContain(
      DEDICATION_THANKS_TEXT,
    );
  });

  test("קובייה פנויה עם מחיר מפנה לרכישה ומציגה את המחיר; בלי מחיר: לתרומה רגילה", async () => {
    const { DedicationTilesView } =
      await import("../../../components/website/dedications/dedication-tiles-view");
    const html = renderToHtml(DedicationTilesView, {
      items: [],
      donateHref: "/donations#donate",
      prices: { sponsor_day: DAY_PRICE },
    });
    expect(html).toContain('href="/donations?dedication=sponsor_day#donate"');
    expect(html).toContain('data-testid="dedication-price-sponsor_day"');
    expect(html).not.toContain("dedication=sponsor_week");
    expect(html).toContain('href="/donations#donate"');
  });
});
