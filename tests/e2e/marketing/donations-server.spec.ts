/**
 * Callers: Playwright `marketing` project (ללא התחברות). בדיקות נתיבי השרת של התרומות מול
 * השרת שב-PLAYWRIGHT_BASE_URL והמסד המקומי: יצירת כוונה, סטטוס, וה-webhook של נדרים פלוס.
 * בדיקות ה-webhook המלאות חותמות עם NEDARIM_WEBHOOK_SECRET (או ערך הבדיקה שמטה), ולכן
 * מדלגות כשבשרת אין אותו סוד. בדיקת "נכשל סגור" רצה תמיד.
 */
import { randomUUID } from "node:crypto";
import { test, expect, type APIRequestContext } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "../shidduchim/fixtures";
import { NEDARIM_CALLBACK_PATH } from "@/features/donations/lib/callback-url";
import {
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  computeSignature,
} from "@/features/donations/lib/verify-webhook";

const SECRET = process.env.NEDARIM_WEBHOOK_SECRET || "playwright-test-secret";
const CALLBACK = "/api/v1/donations/nedarim-callback";
const INTENT = "/api/v1/donations/intent";
const RUN = `e2e${Date.now()}${Math.floor(Math.random() * 1000)}`;
const nowSeconds = () => Math.floor(Date.now() / 1000);

let db: SupabaseClient;
const donationIds: string[] = [];

test.beforeAll(() => {
  db = createServiceClient();
});

test.afterAll(async () => {
  await db.from("donation_payments").delete().like("raw->>RunTag", `${RUN}%`);
  if (donationIds.length > 0) {
    await db.from("donations").delete().in("id", donationIds);
  }
});

async function seedDonation(
  fields: Partial<{ amount: number; frequency: string; currency: number }> = {},
) {
  const { data, error } = await db
    .from("donations")
    .insert({ amount: 180, frequency: "one_time", ...fields })
    .select("id, ref")
    .single();
  expect(error).toBeNull();
  donationIds.push(data!.id);
  return data as { id: string; ref: number };
}

async function donationOf(id: string) {
  const { data } = await db.from("donations").select("*").eq("id", id).single();
  return data as {
    status: string;
    paid_at: string | null;
    provider_keva_id: string | null;
    ref: number;
  };
}

async function paymentsOf(donationId: string) {
  const { data } = await db
    .from("donation_payments")
    .select("*")
    .eq("donation_id", donationId)
    .order("received_at");
  return data ?? [];
}

const tx = (suffix: string) => `${RUN}-${suffix}`;

/** גוף עסקה כפי שהספק שולח; RunTag לניקוי בלבד */
function transactionBody(overrides: Record<string, unknown>) {
  return {
    TransactionId: tx(randomUUID()),
    Amount: "180",
    Currency: "1",
    Confirmation: "0123456",
    LastNum: "4242",
    ClientName: "ישראל ישראלי",
    TransactionTime: "05/10/2026 10:11:12",
    RunTag: RUN,
    ...overrides,
  };
}

interface SendOptions {
  secret?: string;
  timestamp?: number;
  sign?: boolean;
  rawBody?: string;
}

function postCallback(
  request: APIRequestContext,
  body: Record<string, unknown>,
  options: SendOptions = {},
) {
  const raw = options.rawBody ?? JSON.stringify(body);
  const timestamp = String(options.timestamp ?? nowSeconds());
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options.sign !== false) {
    headers[TIMESTAMP_HEADER] = timestamp;
    headers[SIGNATURE_HEADER] = computeSignature(
      options.secret ?? SECRET,
      timestamp,
      raw,
    );
  }
  // Buffer: Playwright לא יסדר מחדש גוף שאינו JSON (החתימה היא על הבייטים)
  return request.post(CALLBACK, { headers, data: Buffer.from(raw) });
}

test.describe("webhook: נכשל סגור (רץ תמיד)", () => {
  test("קריאה בלי חתימה, עם חתימה שגויה או חותמת ישנה נדחית ולא נרשם דבר", async ({
    request,
  }) => {
    const donation = await seedDonation();
    const body = transactionBody({ Param2: donation.id, Amount: "180" });
    const attempts = [
      await postCallback(request, body, { sign: false }),
      await postCallback(request, body, { secret: "wrong-secret" }),
      await postCallback(request, body, { timestamp: nowSeconds() - 3600 }),
      await request.post(CALLBACK, {
        headers: {
          "Content-Type": "application/json",
          [TIMESTAMP_HEADER]: String(nowSeconds()),
          [SIGNATURE_HEADER]: "v1=" + "0".repeat(64),
        },
        data: JSON.stringify(body),
      }),
    ];

    for (const response of attempts) expect(response.status()).toBe(401);
    expect((await donationOf(donation.id)).status).toBe("pending");
    expect(await paymentsOf(donation.id)).toHaveLength(0);
    const { count } = await db
      .from("donation_payments")
      .select("id", { count: "exact", head: true })
      .eq("provider_transaction_id", body.TransactionId as string);
    expect(count).toBe(0);
  });
});

test.describe("יצירת כוונה", () => {
  test("כוונה תקינה נשמרת כ-pending ומחזירה id ו-callbackUrl מהשרת", async ({
    request,
  }) => {
    const response = await request.post(INTENT, {
      data: {
        amount: 360,
        frequency: "monthly",
        dedicationType: "לעילוי נשמת",
        dedicationName: "משה בן שרה",
        firstName: "ישראל",
        lastName: "ישראלי",
        phone: "0501234567",
        email: "a@b.co",
        // מזהה וכתובת מהלקוח חייבים להיות מתעלמים
        id: "11111111-1111-4111-8111-111111111111",
        callbackUrl: "https://evil.example/steal",
        status: "paid",
      },
    });
    expect(response.status()).toBe(201);
    const body = await response.json();
    donationIds.push(body.id);

    expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.id).not.toBe("11111111-1111-4111-8111-111111111111");
    if (body.callbackUrl !== null) {
      expect(body.callbackUrl).toMatch(/^https:\/\//);
      expect(body.callbackUrl.endsWith(NEDARIM_CALLBACK_PATH)).toBe(true);
      expect(body.callbackUrl).not.toContain("evil.example");
    }

    const { data: row } = await db
      .from("donations")
      .select("*")
      .eq("id", body.id)
      .single();
    expect(row).toMatchObject({
      status: "pending",
      amount: 360,
      currency: 1,
      frequency: "monthly",
      dedication_text: "לעילוי נשמת משה בן שרה",
      donor_first_name: "ישראל",
      donor_email: "a@b.co",
      paid_at: null,
      provider_keva_id: null,
    });
  });

  test("בקשה לא תקינה מחזירה 400 ולא יוצרת שורה", async ({ request }) => {
    const invalid = [
      { amount: 5, frequency: "once" },
      {
        amount: 180,
        frequency: "once",
        dedicationType: "לזכות",
        dedicationName: "http://x.co",
      },
      { amount: 180, frequency: "once", email: "nope" },
      { amount: "180", frequency: "once" },
    ];
    for (const data of invalid) {
      const response = await request.post(INTENT, { data });
      expect(response.status(), JSON.stringify(data)).toBe(400);
      expect((await response.json()).error).toEqual(expect.any(String));
    }
    const notJson = await request.post(INTENT, {
      headers: { "Content-Type": "application/json" },
      data: "{not json",
    });
    expect(notJson.status()).toBe(400);
  });
});

test.describe("סטטוס תרומה", () => {
  test("מחזיר רק את הסטטוס; uuid לא קיים 404; לא uuid 400", async ({
    request,
  }) => {
    const donation = await seedDonation();
    const response = await request.get(
      `/api/v1/donations/${donation.id}/status`,
    );
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ status: "pending" });

    await db.from("donations").update({ status: "paid" }).eq("id", donation.id);
    const paid = await request.get(`/api/v1/donations/${donation.id}/status`);
    expect(await paid.json()).toEqual({ status: "paid" });

    expect(
      (await request.get(`/api/v1/donations/${randomUUID()}/status`)).status(),
    ).toBe(404);
    expect(
      (await request.get("/api/v1/donations/not-a-uuid/status")).status(),
    ).toBe(400);
  });
});

test.describe("webhook: קליטה (דורש NEDARIM_WEBHOOK_SECRET בשרת)", () => {
  test.beforeAll(async ({ playwright, baseURL }) => {
    const request = await playwright.request.newContext({ baseURL });
    // גוף חתום תקין אך לא מזוהה: 400 = הסוד מוכר לשרת, 401 = לא מוגדר
    const probe = await postCallback(request, { RunTag: RUN });
    await request.dispose();
    test.skip(
      probe.status() === 401,
      "NEDARIM_WEBHOOK_SECRET לא מוגדר בשרת הזה - בדיקות הקליטה מדלגות",
    );
  });

  test("עסקה חתומה תואמת מסמנת paid ומחזירה WEBDocID", async ({ request }) => {
    const donation = await seedDonation();
    const response = await postCallback(
      request,
      transactionBody({ Param2: donation.id }),
    );
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ WEBDocID: donation.ref });

    const row = await donationOf(donation.id);
    expect(row.status).toBe("paid");
    expect(row.paid_at).not.toBeNull();
    const payments = await paymentsOf(donation.id);
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({
      kind: "transaction",
      matched: true,
      mismatch_reason: null,
      last4: "4242",
      confirmation: "0123456",
      currency: 1,
    });
    expect(Number(payments[0].amount)).toBe(180);
    expect(payments[0].raw.ClientName).toBe("ישראל ישראלי");
    expect(payments[0].transaction_time).toBe("05/10/2026 10:11:12");
    expect(payments[0].transaction_time_parsed).not.toBeNull();
  });

  test("שליחה חוזרת אינה יוצרת שורה נוספת ואינה משנה את התרומה", async ({
    request,
  }) => {
    const donation = await seedDonation();
    const body = transactionBody({ Param2: donation.id });
    expect((await postCallback(request, body)).status()).toBe(200);
    const before = await donationOf(donation.id);

    const replay = await postCallback(request, body);
    expect(replay.status()).toBe(200);
    expect(await replay.json()).toEqual({ WEBDocID: donation.ref });
    expect(await paymentsOf(donation.id)).toHaveLength(1);
    expect((await donationOf(donation.id)).paid_at).toBe(before.paid_at);
  });

  test("חתימה שגויה או חותמת ישנה: 401 והתרומה נשארת pending", async ({
    request,
  }) => {
    const donation = await seedDonation();
    const body = transactionBody({ Param2: donation.id });
    expect(
      (await postCallback(request, body, { secret: "nope" })).status(),
    ).toBe(401);
    expect(
      (
        await postCallback(request, body, { timestamp: nowSeconds() - 600 })
      ).status(),
    ).toBe(401);
    expect((await postCallback(request, body, { sign: false })).status()).toBe(
      401,
    );
    expect((await donationOf(donation.id)).status).toBe("pending");
    expect(await paymentsOf(donation.id)).toHaveLength(0);
  });

  test("אי-התאמת סכום או מטבע: mismatch עם סיבה, בלי WEBDocID", async ({
    request,
  }) => {
    const amountCase = await seedDonation({ amount: 180 });
    const amountResponse = await postCallback(
      request,
      transactionBody({ Param2: amountCase.id, Amount: "18" }),
    );
    expect(await amountResponse.json()).toEqual({});
    expect((await donationOf(amountCase.id)).status).toBe("mismatch");
    const [payment] = await paymentsOf(amountCase.id);
    expect(payment).toMatchObject({ matched: false });
    expect(payment.mismatch_reason).toMatch(/^amount_mismatch/);

    const currencyCase = await seedDonation({ amount: 180 });
    await postCallback(
      request,
      transactionBody({ Param2: currencyCase.id, Currency: "2" }),
    );
    expect((await donationOf(currencyCase.id)).status).toBe("mismatch");
    expect((await paymentsOf(currencyCase.id))[0].mismatch_reason).toMatch(
      /^currency_mismatch/,
    );
  });

  test("Param2 לא מוכר נשמר כתשלום לא מותאם; מזהה שנוצל כבר לא מסמן שוב", async ({
    request,
  }) => {
    const unknown = transactionBody({ Param2: randomUUID() });
    const response = await postCallback(request, unknown);
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({});
    const { data: stored } = await db
      .from("donation_payments")
      .select("*")
      .eq("provider_transaction_id", unknown.TransactionId as string)
      .single();
    expect(stored).toMatchObject({
      donation_id: null,
      matched: false,
      mismatch_reason: "unknown_reference",
    });

    const donation = await seedDonation();
    await postCallback(request, transactionBody({ Param2: donation.id }));
    const second = await postCallback(
      request,
      transactionBody({ Param2: donation.id }),
    );
    expect(await second.json()).toEqual({});
    const payments = await paymentsOf(donation.id);
    expect(payments).toHaveLength(2);
    expect(payments.filter((p) => p.matched)).toHaveLength(1);
    expect(payments.find((p) => !p.matched)?.mismatch_reason).toBe(
      "reference_already_used",
    );
    expect((await donationOf(donation.id)).status).toBe("paid");
  });

  test("הוראת קבע: הקמה, עסקה ראשונה וחיוב חודשי מאוחר עם KevaId בלבד", async ({
    request,
  }) => {
    const donation = await seedDonation({ amount: 360, frequency: "monthly" });
    const kevaId = tx("keva");

    const created = await postCallback(request, {
      KevaId: kevaId,
      Param2: donation.id,
      Amount: "360",
      Currency: "1",
      NextDate: "05/11/2026",
      RunTag: RUN,
    });
    expect(created.status()).toBe(200);
    expect(await created.json()).toEqual({ WEBDocID: donation.ref });
    let row = await donationOf(donation.id);
    expect(row.provider_keva_id).toBe(kevaId);
    expect(row.status).toBe("pending");

    const first = await postCallback(
      request,
      transactionBody({ Param2: donation.id, KevaId: kevaId, Amount: "360" }),
    );
    expect(await first.json()).toEqual({ WEBDocID: donation.ref });
    expect((await donationOf(donation.id)).status).toBe("paid");

    // חיוב חודשי הבא: אין Param2 שלנו, רק KevaId
    const later = await postCallback(
      request,
      transactionBody({ KevaId: kevaId, Amount: "360" }),
    );
    expect(await later.json()).toEqual({ WEBDocID: donation.ref });

    // וגם כשיש Param2 לא מוכר
    const laterUnknownParam = await postCallback(
      request,
      transactionBody({ KevaId: kevaId, Amount: "360", Param2: "x" }),
    );
    expect(await laterUnknownParam.json()).toEqual({ WEBDocID: donation.ref });

    const payments = await paymentsOf(donation.id);
    expect(payments).toHaveLength(4);
    expect(payments.every((p) => p.matched)).toBe(true);
    expect(payments.filter((p) => p.kind === "transaction")).toHaveLength(3);

    // כפילות של הקמת הוראת הקבע
    await postCallback(request, { KevaId: kevaId, Amount: "360", RunTag: RUN });
    expect(await paymentsOf(donation.id)).toHaveLength(4);
    row = await donationOf(donation.id);
    expect(row.status).toBe("paid");
  });

  test("עסקת כרטיס בלי Confirmation: נרשמת כזמנית, התרומה נשארת pending", async ({
    request,
  }) => {
    const donation = await seedDonation();
    for (const confirmation of [undefined, "", "0"]) {
      const fresh = await seedDonation();
      const response = await postCallback(
        request,
        transactionBody({ Param2: fresh.id, Confirmation: confirmation }),
      );
      expect(response.status()).toBe(200);
      expect(await response.json()).toEqual({ WEBDocID: fresh.ref });
      const row = await donationOf(fresh.id);
      expect(row.status, String(confirmation)).toBe("pending");
      expect(row.paid_at).toBeNull();
      const [payment] = await paymentsOf(fresh.id);
      expect(payment).toMatchObject({
        matched: true,
        mismatch_reason: null,
        is_temporary: true,
        confirmation: null,
      });
    }

    const status = await request.get(`/api/v1/donations/${donation.id}/status`);
    expect(await status.json()).toEqual({ status: "pending" });
  });

  test("עדכון מאוחר עם אישור משדרג עסקה זמנית ל-paid בשורה אחת; כפילות אינה משנה", async ({
    request,
  }) => {
    const donation = await seedDonation();
    const transactionId = tx(randomUUID());
    const temporary = transactionBody({
      TransactionId: transactionId,
      Param2: donation.id,
      Confirmation: "",
    });
    await postCallback(request, temporary);
    expect((await donationOf(donation.id)).status).toBe("pending");

    // כפילות של העדכון הזמני עצמו: אין שינוי
    const temporaryReplay = await postCallback(request, temporary);
    expect(await temporaryReplay.json()).toEqual({ WEBDocID: donation.ref });
    expect((await donationOf(donation.id)).status).toBe("pending");

    const confirmed = {
      ...temporary,
      Confirmation: "7654321",
      RunTag: RUN,
    };
    const upgrade = await postCallback(request, confirmed);
    expect(upgrade.status()).toBe(200);
    expect(await upgrade.json()).toEqual({ WEBDocID: donation.ref });

    const paid = await donationOf(donation.id);
    expect(paid.status).toBe("paid");
    expect(paid.paid_at).not.toBeNull();
    const payments = await paymentsOf(donation.id);
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({
      is_temporary: false,
      matched: true,
      mismatch_reason: null,
      confirmation: "7654321",
    });
    expect(payments[0].raw.Confirmation).toBe("7654321");
    expect(payments[0].raw_history).toHaveLength(1);
    expect(payments[0].raw_history[0].Confirmation).toBe("");

    // כפילות מדויקת של העדכון המאשר, ואחריה עדכון זמני מאוחר: בלי שינוי
    for (const replay of [confirmed, temporary]) {
      const response = await postCallback(request, replay);
      expect(await response.json()).toEqual({ WEBDocID: donation.ref });
    }
    const after = await donationOf(donation.id);
    expect(after.status).toBe("paid");
    expect(after.paid_at).toBe(paid.paid_at);
    const afterPayments = await paymentsOf(donation.id);
    expect(afterPayments).toHaveLength(1);
    expect(afterPayments[0].raw_history).toHaveLength(1);
    expect(afterPayments[0].confirmation).toBe("7654321");
  });

  test("ביט וסולקים שאינם אשראי (27, כמספר וכמחרוזת) בלי Confirmation: paid", async ({
    request,
  }) => {
    for (const solek of ["27", 27, 30]) {
      const donation = await seedDonation();
      const response = await postCallback(
        request,
        transactionBody({
          Param2: donation.id,
          Solek: solek,
          Confirmation: undefined,
        }),
      );
      expect(await response.json()).toEqual({ WEBDocID: donation.ref });
      expect((await donationOf(donation.id)).status, String(solek)).toBe(
        "paid",
      );
      const [payment] = await paymentsOf(donation.id);
      expect(payment).toMatchObject({ is_temporary: false, matched: true });
    }
  });

  test("זמנית ואחריה עדכון מאשר עם סכום שונה: mismatch", async ({
    request,
  }) => {
    const donation = await seedDonation({ amount: 180 });
    const transactionId = tx(randomUUID());
    await postCallback(
      request,
      transactionBody({
        TransactionId: transactionId,
        Param2: donation.id,
        Confirmation: "",
      }),
    );
    expect((await donationOf(donation.id)).status).toBe("pending");

    const response = await postCallback(
      request,
      transactionBody({
        TransactionId: transactionId,
        Param2: donation.id,
        Amount: "18",
      }),
    );
    expect(await response.json()).toEqual({});
    expect((await donationOf(donation.id)).status).toBe("mismatch");
    const payments = await paymentsOf(donation.id);
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({ matched: false, is_temporary: false });
    expect(payments[0].mismatch_reason).toMatch(/^amount_mismatch/);
  });

  test("חיוב חודשי בלי Confirmation אינו משנה תרומה ששולמה ונרשם כזמני", async ({
    request,
  }) => {
    const donation = await seedDonation({ amount: 360, frequency: "monthly" });
    const kevaId = tx("keva-temp");
    await postCallback(
      request,
      transactionBody({ Param2: donation.id, KevaId: kevaId, Amount: "360" }),
    );
    const paid = await donationOf(donation.id);
    expect(paid.status).toBe("paid");

    const chargeId = tx(randomUUID());
    const charge = transactionBody({
      TransactionId: chargeId,
      KevaId: kevaId,
      Amount: "360",
      Confirmation: "",
    });
    const response = await postCallback(request, charge);
    expect(await response.json()).toEqual({ WEBDocID: donation.ref });
    const after = await donationOf(donation.id);
    expect(after.status).toBe("paid");
    expect(after.paid_at).toBe(paid.paid_at);
    const temporary = (await paymentsOf(donation.id)).filter(
      (p) => p.is_temporary,
    );
    expect(temporary).toHaveLength(1);
    expect(temporary[0].provider_transaction_id).toBe(chargeId);
  });

  test("גוף חתום שאינו JSON או לא מזוהה: 400 ולא נרשם", async ({ request }) => {
    const notJson = await postCallback(request, {}, { rawBody: "not json" });
    expect(notJson.status()).toBe(400);
    const unrecognized = await postCallback(request, { Amount: "1" });
    expect(unrecognized.status()).toBe(400);
  });
});
