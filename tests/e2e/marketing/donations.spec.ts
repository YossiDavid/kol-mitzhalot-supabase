/**
 * Callers: Playwright `marketing` project (ללא התחברות).
 * מכסה את בניית ה-Value ל-StartPayment, ההגדרות וההודעות (בדיקות יחידה), את זרימת
 * ה-iframe של נדרים פלוס בעמוד /donations, והקישורים אליו.
 * הספק האמיתי אף פעם לא נטען: כל בקשה ל-www.matara.pro נענית ב-page.route במסמך
 * stub, ומכיוון שהוא מוגש מכתובת הספק גם ה-origin תואם לבדיקה של האפליקציה.
 * הטופס מוצג רק כששני משתני הסביבה של נדרים פלוס תקינים בשרת; אחרת הבדיקות שלו
 * מדלגות ורץ מסלול ה-fallback.
 */
import { test, expect, type Page } from "@playwright/test";
import {
  DONATION_AMOUNT_MAX,
  DONATION_AMOUNT_MIN,
  resolveNedarimApiValid,
  resolveNedarimConfig,
  resolveNedarimMosadId,
} from "@/features/donations/lib/nedarim";
import {
  DONOR_ID_INVALID_MESSAGE,
  validateDonationFormClient,
  NO_DEDICATION,
  type DonationFormValues,
} from "@/features/donations/lib/donation-form";
import { resolveProviderError } from "@/features/donations/lib/provider-errors";
import { parseFrameMessage } from "@/features/donations/lib/frame-messages";
import {
  COMMENT_MAX_LENGTH,
  buildStartPaymentValue,
} from "@/features/donations/lib/start-payment";

const MOSAD = "1234567";
const API_VALID = "test-valid";
const DONOR_ID = "123456789";
const base = {
  mosadId: MOSAD,
  donorId: DONOR_ID,
  apiValid: API_VALID,
  amount: 180,
  frequency: "once" as const,
};

test.describe("buildStartPaymentValue", () => {
  test("תרומה חד-פעמית פשוטה", () => {
    const value = buildStartPaymentValue({ ...base, createId: () => "id-1" });
    expect(value).toEqual({
      Mosad: MOSAD,
      ApiValid: API_VALID,
      Amount: "180",
      PaymentType: "Ragil",
      Currency: "1",
      Tashlumim: "1",
      Groupe: "תרומה",
      Param2: "id-1",
      ButtonText: "תרומה",
      Zeout: DONOR_ID,
    });
  });

  test("הוראת קבע חודשית עם הקדשה ופרטי תורם", () => {
    const value = buildStartPaymentValue({
      ...base,
      amount: 360,
      frequency: "monthly",
      dedication: " לעילוי נשמת  משה בן שרה ",
      firstName: " ישראל ",
      lastName: "ישראלי",
      phone: "+972501234567",
      email: "a@b.co",
      createId: () => "id-2",
    });
    expect(value).toEqual({
      Mosad: MOSAD,
      ApiValid: API_VALID,
      Amount: "360",
      PaymentType: "HK",
      Currency: "1",
      Tashlumim: "",
      Groupe: "הנצחה",
      Param2: "id-2",
      ButtonText: "תרומה",
      FirstName: "ישראל",
      LastName: "ישראלי",
      Phone: "0501234567",
      Mail: "a@b.co",
      Comment: "לעילוי נשמת משה בן שרה",
      Zeout: DONOR_ID,
    });
    expect(value).not.toHaveProperty("Param1");
  });

  test("טלפון ומייל לא תקינים לא נשלחים, ואין undefined", () => {
    const value = buildStartPaymentValue({
      ...base,
      phone: "abc",
      email: "not-an-email",
      firstName: "  ",
    }) as Record<string, unknown>;
    for (const key of ["Phone", "Mail", "FirstName", "LastName", "Comment"]) {
      expect(value).not.toHaveProperty(key);
    }
    for (const entry of Object.values(value)) {
      expect(typeof entry).toBe("string");
    }
  });

  test("Param2 ייחודי לכל ניסיון", () => {
    const first = buildStartPaymentValue(base);
    const second = buildStartPaymentValue(base);
    expect(first?.Param2).toMatch(/^[0-9a-f-]{36}$/);
    expect(first?.Param2).not.toBe(second?.Param2);
  });

  test("הערה נחתכת ל-300 תווים", () => {
    const value = buildStartPaymentValue({
      ...base,
      dedication: "א".repeat(500),
    });
    expect(value?.Comment).toHaveLength(COMMENT_MAX_LENGTH);
  });

  test("הערה עם קישור או תגית נדחית", () => {
    for (const dedication of [
      "לזכות http://x.co",
      "לזכות WWW.x.co",
      "לזכות <img src=x>",
      "לזכות src=1",
    ]) {
      expect(buildStartPaymentValue({ ...base, dedication })).toBeNull();
    }
  });

  test("Zeout: רווחים ומקפים מוסרים, 4 עד 9 ספרות", () => {
    const zeoutOf = (donorId: string) =>
      buildStartPaymentValue({ ...base, donorId })?.Zeout;
    expect(zeoutOf(" 123-456 789 ")).toBe("123456789");
    expect(zeoutOf("1234")).toBe("1234");
    expect(zeoutOf("012345678")).toBe("012345678");
  });

  test("בלי מספר זהות: אין מפתח Zeout בכלל (גם לא ריק)", () => {
    for (const donorId of [undefined, "", "   ", " - "]) {
      const value = buildStartPaymentValue({ ...base, donorId });
      expect(value, String(donorId)).not.toBeNull();
      expect(value, String(donorId)).not.toHaveProperty("Zeout");
    }
  });

  test("הוראת קבע בלי מספר זהות נשלחת בלי Zeout (תורמים מחו״ל); עם מספר שולחת Zeout", () => {
    const monthly = { ...base, frequency: "monthly" as const };
    for (const donorId of [undefined, "", " - "]) {
      const value = buildStartPaymentValue({ ...monthly, donorId });
      expect(value, String(donorId)).not.toBeNull();
      expect(value, String(donorId)).not.toHaveProperty("Zeout");
      expect(value?.PaymentType).toBe("HK");
    }
    // ערך שהוקלד ואינו תקין לעולם לא נשלח לספק
    expect(buildStartPaymentValue({ ...monthly, donorId: "123" })).toBeNull();
    expect(buildStartPaymentValue(monthly)?.Zeout).toBe(DONOR_ID);
  });

  test("מספר זהות שהוקלד ואינו תקין מחזיר null ולא נשלח", () => {
    for (const donorId of ["123", "1234567890", "12a456", "12.456", "١٢٣٤٥٦"]) {
      expect(buildStartPaymentValue({ ...base, donorId }), donorId).toBeNull();
    }
  });

  test("סכום לא תקין מחזיר null", () => {
    for (const amount of [
      0,
      -5,
      1.5,
      Number.NaN,
      DONATION_AMOUNT_MIN - 1,
      DONATION_AMOUNT_MAX + 1,
    ]) {
      expect(buildStartPaymentValue({ ...base, amount })).toBeNull();
    }
    expect(
      buildStartPaymentValue({ ...base, amount: DONATION_AMOUNT_MIN }),
    ).not.toBeNull();
    expect(
      buildStartPaymentValue({ ...base, amount: DONATION_AMOUNT_MAX }),
    ).not.toBeNull();
  });
});

test.describe("הגדרות נדרים פלוס", () => {
  test("מספר מוסד: 7 ספרות בדיוק", () => {
    for (const raw of [undefined, null, "", "123456", "12345678", "12a4567"]) {
      expect(resolveNedarimMosadId(raw)).toBeNull();
    }
    expect(resolveNedarimMosadId(` ${MOSAD} `)).toBe(MOSAD);
  });

  test("ApiValid: לא ריק ובאורך סביר", () => {
    for (const raw of [undefined, null, "", "   ", "x".repeat(101)]) {
      expect(resolveNedarimApiValid(raw)).toBeNull();
    }
    expect(resolveNedarimApiValid(` ${API_VALID} `)).toBe(API_VALID);
  });

  test("ההגדרה המלאה דורשת את שני הערכים", () => {
    expect(
      resolveNedarimConfig({ mosadId: MOSAD, apiValid: API_VALID }),
    ).toEqual({ mosadId: MOSAD, apiValid: API_VALID });
    expect(resolveNedarimConfig({ mosadId: MOSAD, apiValid: "" })).toBeNull();
    expect(
      resolveNedarimConfig({ mosadId: "1", apiValid: API_VALID }),
    ).toBeNull();
  });
});

test.describe("וולידציה והודעות", () => {
  const values: DonationFormValues = {
    presetAmount: 180,
    customAmount: "",
    dedicationType: "לזכות",
    dedicationName: "משה",
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    donorId: DONOR_ID,
  };

  test("קישור בשם ההקדשה נדחה בעברית", () => {
    expect(validateDonationFormClient(values, "once")).toEqual({});
    const errors = validateDonationFormClient(
      {
        ...values,
        dedicationName: "http://evil.co",
      },
      "once",
    );
    expect(errors.dedicationName).toMatch(/קישורים/);
    expect(
      validateDonationFormClient(
        { ...values, dedicationType: NO_DEDICATION },
        "once",
      ),
    ).toEqual({});
  });

  test("מספר זהות אופציונלי: ריק תקין, ואם הוקלד ספרות בלבד, 4 עד 9", () => {
    for (const donorId of ["", "  ", " - "]) {
      expect(
        validateDonationFormClient({ ...values, donorId }, "once"),
        donorId,
      ).toEqual({});
    }
    for (const donorId of ["123", "1234567890", "12ab56", "12-3"]) {
      expect(
        validateDonationFormClient({ ...values, donorId }, "once").donorId,
        donorId,
      ).toBe(DONOR_ID_INVALID_MESSAGE);
    }
    for (const donorId of ["1234", "123456789", " 12-34 56 "]) {
      expect(
        validateDonationFormClient({ ...values, donorId }, "once"),
        donorId,
      ).toEqual({});
    }
  });

  test("מספר זהות אינו חובה גם בהוראת קבע; ערך שהוקלד עדיין נבדק", () => {
    expect(
      validateDonationFormClient({ ...values, donorId: "" }, "monthly"),
    ).toEqual({});
    expect(
      validateDonationFormClient({ ...values, donorId: "12" }, "monthly")
        .donorId,
    ).toBe(DONOR_ID_INVALID_MESSAGE);
    expect(validateDonationFormClient(values, "monthly")).toEqual({});
    expect(
      validateDonationFormClient({ ...values, donorId: "" }, "once"),
    ).toEqual({});
  });

  test("resolveProviderError ממפה NEED ZEOUT (בכל רישיות, בתוך טקסט) לשדה הזהות", () => {
    for (const message of [
      "NEED ZEOUT",
      " need zeout ",
      "Error: NEED ZEOUT.",
    ]) {
      expect(resolveProviderError(message), message).toMatchObject({
        field: "donorId",
        message: expect.stringContaining("תעודת זהות"),
      });
    }
    expect(resolveProviderError("NEED PHONE")?.field).toBe("phone");
    expect(resolveProviderError(" need Mail")?.field).toBe("email");
    for (const message of [
      null,
      "",
      "נדחה",
      "Declined",
      "NEED ADRESSE",
      "we NEED PHONE",
    ]) {
      expect(resolveProviderError(message), String(message)).toBeNull();
    }
  });

  test("parseFrameMessage מצמצם הודעות לא אמינות", () => {
    expect(parseFrameMessage({ Name: "Ready", Value: { Version: 3 } })).toEqual(
      { type: "ready" },
    );
    expect(parseFrameMessage({ Name: "Height", Value: "300" })).toEqual({
      type: "height",
      height: 300,
    });
    expect(parseFrameMessage({ Name: "Height", Value: "abc" })).toBeNull();
    expect(parseFrameMessage({ Name: "Back" })).toEqual({ type: "back" });
    expect(
      parseFrameMessage({
        Name: "TransactionResponse",
        Value: JSON.stringify({ Status: "OK" }),
      }),
    ).toEqual({ type: "transaction", isOk: true, message: null });
    expect(
      parseFrameMessage({
        Name: "TransactionResponse",
        Value: { Status: "Error", Message: "x" },
      }),
    ).toEqual({ type: "transaction", isOk: false, message: "x" });
    expect(
      parseFrameMessage({ Name: "TransactionResponse", Value: "not json" }),
    ).toEqual({ type: "transaction", isOk: false, message: null });
    expect(parseFrameMessage({ Name: "PendingTransaction" })).toEqual({
      type: "other",
    });
    for (const junk of [null, "Ready", 5, { Name: 5 }, []]) {
      expect(parseFrameMessage(junk)).toBeNull();
    }
  });
});

/**
 * מסמך ה-stub של ה-iframe: שולח Ready ו-Height בטעינה, רושם כל הודעה שהגיעה אליו
 * (window.__received, עם ה-origin של השולח) ומאפשר לבדיקה לשלוח אירועים להורה.
 */
const STUB_FRAME_HTML = `<!doctype html><html><body><script>
  window.__received = [];
  window.emit = function (message) { parent.postMessage(message, "*"); };
  window.addEventListener("message", function (event) {
    window.__received.push({ origin: event.origin, data: event.data });
    if (event.data && event.data.Name === "GetHeight") {
      parent.postMessage({ Name: "Height", Value: "300" }, "*");
    }
  });
  parent.postMessage({ Name: "Ready", Value: { Version: 3 } }, "*");
  parent.postMessage({ Name: "Height", Value: "300" }, "*");
</script></body></html>`;

const CONTINUE_BUTTON = /המשך לתשלום/;

const UI_DONOR_ID = "123-456 782";
const NEED_ZEOUT_MESSAGE =
  "חברת הסליקה דורשת מספר תעודת זהות להשלמת התרומה בכרטיס זה. נא להזין ולנסות שוב.";
const NEED_ZEOUT_FRAME_MESSAGE = {
  Name: "TransactionResponse",
  Value: JSON.stringify({ Status: "Error", Message: "NEED ZEOUT" }),
};

const INTENT_ROUTE = "**/api/v1/donations/intent";
const STATUS_ROUTE = "**/api/v1/donations/*/status";

type IntentStub = { id: string; callbackUrl: string | null };

/** מענה מדומה של נקודת הקצה ליצירת כוונה (הנקודה האמיתית נבדקת ב-donations-server) */
function stubIntent(
  page: Page,
  make: () => IntentStub = () => ({
    id: crypto.randomUUID(),
    callbackUrl: null,
  }),
) {
  return page.route(INTENT_ROUTE, (route) =>
    route.fulfill({ status: 201, json: make() }),
  );
}

/** פותח את העמוד עם ה-stub; מדלג כשבשרת אין הגדרה תקינה (מסלול fallback) */
async function openDonationPage(page: Page) {
  await stubIntent(page);
  await page.route("https://www.matara.pro/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: STUB_FRAME_HTML,
    }),
  );
  await page.goto("/donations");
  test.skip(
    (await page.getByRole("button", { name: CONTINUE_BUTTON }).count()) === 0,
    "משתני הסביבה של נדרים פלוס לא מוגדרים בשרת - רץ מסלול ה-fallback",
  );
}

const fillDonorId = (page: Page, value = UI_DONOR_ID) =>
  page.getByLabel("תעודת זהות").fill(value);

async function fillMonthlyDedication(page: Page) {
  await page.getByText("360 ₪").click();
  // ה-radio עצמו מוסתר חזותית (sr-only), לכן לוחצים על הכרטיס
  await page.getByText("הוראת קבע חודשית", { exact: true }).click();
  await page.getByLabel("סוג ההקדשה").selectOption("לעילוי נשמת");
  await page.getByLabel("שם", { exact: true }).fill("משה בן שרה");
  await page.getByLabel("שם פרטי").fill("ישראל");
  await page.getByLabel("שם משפחה").fill("ישראלי");
}

function stubFrame(page: Page) {
  const frame = page.frame({ url: /matara\.pro/ });
  expect(frame).not.toBeNull();
  return frame!;
}

type Received = { origin: string; data: { Name: string; Value?: unknown } };

/** ההודעות שהגיעו ל-iframe, בלי GetHeight (נשלחת אוטומטית בעליית המאזין) */
const received = async (page: Page) =>
  (
    await stubFrame(page).evaluate(
      () => (window as unknown as { __received: Received[] }).__received,
    )
  ).filter((message) => message.data.Name !== "GetHeight");

const emit = (page: Page, message: object) =>
  stubFrame(page).evaluate(
    (payload) =>
      (window as unknown as { emit: (m: object) => void }).emit(payload),
    message,
  );

/** ה-iframe נשאר מורכב (גובה 0 וחתוך), ולכן הסתרה נבדקת לפי aria-hidden של העטיפה */
const expectFrameHidden = (page: Page) =>
  expect(page.getByTestId("donation-frame-wrapper")).toHaveAttribute(
    "aria-hidden",
    "true",
  );

const OK_MESSAGE = {
  Name: "TransactionResponse",
  Value: JSON.stringify({ Status: "OK", ID: "1" }),
};

test.describe("עמוד תרומות והנצחות", () => {
  test("העמוד נטען עם כותרת, הנצחות והבהרה על נדרים פלוס", async ({ page }) => {
    await page.goto("/donations");
    await expect(
      page.getByRole("heading", { level: 1, name: "תרומות והנצחות" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "הנצחות", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("נדרים פלוס").first()).toBeVisible();
  });

  test("המשך לתשלום מציג את ה-iframe ומזריק את הערכים", async ({ page }) => {
    await openDonationPage(page);
    await fillMonthlyDedication(page);
    await fillDonorId(page);
    await page.getByRole("button", { name: CONTINUE_BUTTON }).click();

    await expect(page.locator("#NedarimFrame")).toBeVisible();
    await expect(
      page.getByRole("button", { name: CONTINUE_BUTTON }),
    ).toHaveCount(0);

    await expect.poll(async () => (await received(page)).length).toBe(1);
    const [message] = await received(page);
    expect(message.origin).toBe(new URL(page.url()).origin);
    expect(message.data.Name).toBe("StartPayment");
    const value = message.data.Value as Record<string, string>;
    expect(value.Mosad).toMatch(/^\d{7}$/);
    expect(value.ApiValid).not.toBe("");
    expect(value).toMatchObject({
      Amount: "360",
      PaymentType: "HK",
      Tashlumim: "",
      Currency: "1",
      Groupe: "הנצחה",
      Comment: "לעילוי נשמת משה בן שרה",
      FirstName: "ישראל",
      LastName: "ישראלי",
      ButtonText: "תרומה",
      Zeout: "123456782",
    });
    expect(value).not.toHaveProperty("Param1");
    expect(value.Param2).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("Back מחזיר לטופס עם הערכים שהוזנו", async ({ page }) => {
    await openDonationPage(page);
    await fillMonthlyDedication(page);
    await fillDonorId(page);
    await page.getByRole("button", { name: CONTINUE_BUTTON }).click();
    await expect(page.locator("#NedarimFrame")).toBeVisible();

    await emit(page, { Name: "Back" });

    await expect(
      page.getByRole("button", { name: CONTINUE_BUTTON }),
    ).toBeVisible();
    await expect(page.getByLabel("שם", { exact: true })).toHaveValue(
      "משה בן שרה",
    );
    await expect(page.getByLabel("שם פרטי")).toHaveValue("ישראל");
    await expect(
      page.getByRole("radio", { name: /הוראת קבע חודשית/ }),
    ).toBeChecked();
  });

  test("תשלום מוצלח מציג תודה, ותרומה נוספת שולחת Reset וחוזרת לטופס", async ({
    page,
  }) => {
    await openDonationPage(page);
    await page.getByRole("button", { name: CONTINUE_BUTTON }).click();
    await expect(page.locator("#NedarimFrame")).toBeVisible();

    await emit(page, OK_MESSAGE);
    const thanks = page.getByTestId("donation-thanks");
    await expect(thanks).toHaveCount(1);
    await expect(thanks.getByText("תודה רבה!")).toBeVisible();

    await thanks.getByRole("button", { name: "תרומה נוספת" }).click();
    await expect(thanks).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: CONTINUE_BUTTON }),
    ).toBeVisible();
    await expect
      .poll(async () => (await received(page)).map((m) => m.data.Name))
      .toEqual(["StartPayment", "Reset"]);
  });

  test("שגיאת תשלום לא משנה את המסך (ה-iframe מציג אותה)", async ({ page }) => {
    await openDonationPage(page);
    await page.getByRole("button", { name: CONTINUE_BUTTON }).click();
    await expect(page.locator("#NedarimFrame")).toBeVisible();

    await emit(page, {
      Name: "TransactionResponse",
      Value: JSON.stringify({ Status: "Error", Message: "נדחה" }),
    });

    await expect(page.getByTestId("donation-thanks")).toHaveCount(0);
    await expect(page.locator("#NedarimFrame")).toBeVisible();
  });

  test("הודעה מ-origin או ממקור אחר מתעלמים ממנה", async ({ page }) => {
    await openDonationPage(page);
    await page.getByRole("button", { name: CONTINUE_BUTTON }).click();
    await expect(page.locator("#NedarimFrame")).toBeVisible();

    // הודעה מהעמוד עצמו: origin שונה ומקור שאינו ה-iframe
    await page.evaluate((message) => window.postMessage(message, "*"), {
      ...OK_MESSAGE,
    });
    await page.evaluate(() => window.postMessage({ Name: "Back" }, "*"));
    await page.waitForTimeout(300);

    await expect(page.getByTestId("donation-thanks")).toHaveCount(0);
    await expect(page.locator("#NedarimFrame")).toBeVisible();
    await expect(
      page.getByRole("button", { name: CONTINUE_BUTTON }),
    ).toHaveCount(0);
  });

  test("מאזין יחיד ושליחה יחידה: לחיצה כפולה והודעה אחת", async ({ page }) => {
    await openDonationPage(page);
    await page.getByRole("button", { name: CONTINUE_BUTTON }).dblclick();
    await expect(page.locator("#NedarimFrame")).toBeVisible();
    await page.waitForTimeout(300);
    expect(
      (await received(page)).filter((m) => m.data.Name === "StartPayment"),
    ).toHaveLength(1);

    await emit(page, OK_MESSAGE);
    await expect(page.getByTestId("donation-thanks")).toHaveCount(1);
  });

  test("שגיאות וולידציה בעברית ללא מעבר ל-iframe", async ({ page }) => {
    await openDonationPage(page);

    await page.getByLabel("סכום אחר (בש״ח)").fill("5");
    await page.getByLabel("סוג ההקדשה").selectOption("לזכות");
    await page.getByLabel("טלפון").fill("abc");
    await page.getByRole("button", { name: CONTINUE_BUTTON }).click();

    await expect(page.getByText(/הסכום צריך להיות מספר שלם/)).toBeVisible();
    await expect(
      page.getByText("נא להזין את שם מי שמוקדשת התרומה."),
    ).toBeVisible();
    await expectFrameHidden(page);
  });

  test("מספר זהות ריק: ממשיכים, וב-StartPayment אין מפתח Zeout", async ({
    page,
  }) => {
    await openDonationPage(page);
    await page.getByRole("button", { name: CONTINUE_BUTTON }).click();
    await expect(page.locator("#NedarimFrame")).toBeVisible();
    await expect.poll(async () => (await received(page)).length).toBe(1);
    const [message] = await received(page);
    expect(message.data.Value).not.toHaveProperty("Zeout");
  });

  test("מספר זהות שהוקלד ואינו תקין נחסם בטופס, ובלי קריאה לשרת", async ({
    page,
  }) => {
    await openDonationPage(page);
    let intentCalls = 0;
    await page.route(INTENT_ROUTE, (route) => {
      intentCalls += 1;
      return route.fulfill({ status: 201, json: { id: crypto.randomUUID() } });
    });
    const donorId = page.getByLabel("תעודת זהות");
    const submit = page.getByRole("button", { name: CONTINUE_BUTTON });

    await donorId.fill("12ab56");
    await submit.click();
    await expect(page.getByText(/4 עד 9 ספרות/)).toBeVisible();
    await expect(donorId).toBeFocused();

    await donorId.fill("123");
    await submit.click();
    await expect(page.getByText(/4 עד 9 ספרות/)).toBeVisible();

    await expectFrameHidden(page);
    expect(await received(page)).toHaveLength(0);
    expect(intentCalls).toBe(0);
  });

  test("NEED ZEOUT מהספק: חזרה לטופס עם ערכים, הודעה ומיקוד, והמשך שולח Zeout", async ({
    page,
  }) => {
    await openDonationPage(page);
    await page.getByLabel("שם פרטי").fill("ישראל");
    await page.getByLabel("טלפון").fill("0501234567");
    await page.getByRole("button", { name: CONTINUE_BUTTON }).click();
    await expect(page.locator("#NedarimFrame")).toBeVisible();

    await emit(page, NEED_ZEOUT_FRAME_MESSAGE);

    const donorId = page.getByLabel("תעודת זהות");
    await expect(
      page.getByRole("button", { name: CONTINUE_BUTTON }),
    ).toBeVisible();
    await expect(page.getByText(NEED_ZEOUT_MESSAGE)).toBeVisible();
    await expect(donorId).toBeFocused();
    await expect(page.getByLabel("שם פרטי")).toHaveValue("ישראל");
    await expect(page.getByLabel("טלפון")).toHaveValue("0501234567");
    await expectFrameHidden(page);

    await fillDonorId(page);
    await page.getByRole("button", { name: CONTINUE_BUTTON }).click();
    await expect.poll(async () => (await received(page)).length).toBe(2);
    const [first, second] = await received(page);
    expect(first.data.Value).not.toHaveProperty("Zeout");
    expect(second.data.Name).toBe("StartPayment");
    expect(second.data.Value).toMatchObject({ Zeout: "123456782" });
    expect((second.data.Value as Record<string, string>).Param2).not.toBe(
      (first.data.Value as Record<string, string>).Param2,
    );
  });

  test("NEED PHONE מהספק: חזרה לטופס עם מיקוד בטלפון והודעה", async ({
    page,
  }) => {
    await openDonationPage(page);
    await page.getByRole("button", { name: CONTINUE_BUTTON }).click();
    await expect(page.locator("#NedarimFrame")).toBeVisible();

    await emit(page, {
      Name: "TransactionResponse",
      Value: JSON.stringify({ Status: "Error", Message: "NEED PHONE" }),
    });

    await expect(page.getByLabel("טלפון")).toBeFocused();
    await expect(page.getByText(/דורשת מספר טלפון/)).toBeVisible();
  });

  test("הוראת קבע אינה דורשת מספר זהות בטופס, ושדה הזהות מציג רמז מתאים", async ({
    page,
  }) => {
    await openDonationPage(page);
    await expect(page.getByText(/חברת הסליקה עשויה לדרוש זאת/)).toBeVisible();
    await expect(page.getByText(/לתורמים מחו״ל/)).toHaveCount(2);

    await page.getByText("הוראת קבע חודשית", { exact: true }).click();
    await expect(
      page.getByText(/בהוראת קבע חברת הסליקה דורשת זאת בדרך כלל/),
    ).toBeVisible();

    // תורם בלי תעודת זהות ישראלית ממשיך; אם הסליקה תדרוש, יחזור עם NEED ZEOUT
    await page.getByRole("button", { name: CONTINUE_BUTTON }).click();
    await expect.poll(async () => (await received(page)).length).toBe(1);
    const value = (await received(page))[0].data.Value;
    expect(value).toMatchObject({ PaymentType: "HK" });
    expect(value).not.toHaveProperty("Zeout");
  });

  test("שגיאה אחרת מהספק: נשארים ב-iframe ולא חוזרים לטופס", async ({
    page,
  }) => {
    await openDonationPage(page);
    await page.getByRole("button", { name: CONTINUE_BUTTON }).click();
    await expect(page.locator("#NedarimFrame")).toBeVisible();

    await emit(page, {
      Name: "TransactionResponse",
      Value: JSON.stringify({ Status: "Error", Message: "כרטיס נדחה" }),
    });
    await page.waitForTimeout(300);

    await expect(
      page.getByRole("button", { name: CONTINUE_BUTTON }),
    ).toHaveCount(0);
    await expect(page.getByText(NEED_ZEOUT_MESSAGE)).toBeHidden();
    await expect(page.locator("#NedarimFrame")).toBeVisible();
  });

  test("מספר הזהות נשלח רק ל-iframe ולא בבקשת הכוונה לשרת", async ({
    page,
  }) => {
    await openDonationPage(page);
    await fillDonorId(page);
    const intentBodies: string[] = [];
    await page.route(INTENT_ROUTE, (route) => {
      intentBodies.push(route.request().postData() ?? "");
      return route.fulfill({
        status: 201,
        json: { id: crypto.randomUUID(), callbackUrl: null },
      });
    });
    await page.getByRole("button", { name: CONTINUE_BUTTON }).click();
    await expect(page.locator("#NedarimFrame")).toBeVisible();

    expect(intentBodies).toHaveLength(1);
    const body = JSON.parse(intentBodies[0]) as Record<string, unknown>;
    for (const key of Object.keys(body)) {
      expect(key.toLowerCase()).not.toMatch(/zeout|donorid|idnumber|tz/);
    }
    expect(intentBodies[0]).not.toContain("123456782");
    expect(intentBodies[0]).not.toContain("123-456 782");

    await expect.poll(async () => (await received(page)).length).toBe(1);
    const [message] = await received(page);
    expect(message.data.Value).toMatchObject({ Zeout: "123456782" });
  });

  test("קישור בהקדשה נחסם בטופס", async ({ page }) => {
    await openDonationPage(page);

    await page.getByLabel("סוג ההקדשה").selectOption("לזכות");
    await page.getByLabel("שם", { exact: true }).fill("www.example.com");
    await page.getByRole("button", { name: CONTINUE_BUTTON }).click();

    await expect(page.getByText(/אי אפשר לכלול קישורים/)).toBeVisible();
    await expectFrameHidden(page);
    expect(await received(page)).toHaveLength(0);
  });

  test("ללא הגדרה תקינה מוצגת פנייה ליצירת קשר במקום הטופס", async ({
    page,
  }) => {
    await page.goto("/donations");
    const hasForm =
      (await page.getByRole("button", { name: CONTINUE_BUTTON }).count()) > 0;
    test.skip(hasForm, "הגדרת נדרים פלוס קיימת בשרת - הטופס מוצג");

    const fallback = page.getByTestId("donation-unavailable");
    await expect(fallback).toBeVisible();
    await expect(
      fallback.getByRole("link", { name: "צרו קשר" }),
    ).toHaveAttribute("href", "/contact");
  });

  test("עמוד התודה העצמאי נטען", async ({ page }) => {
    await page.goto("/donations/thanks");
    await expect(
      page.getByRole("heading", { name: "תודה רבה!" }),
    ).toBeVisible();
  });
});

test.describe("קישורים לעמוד התרומות", () => {
  test("הדר האתר מציג כפתור תרומות בדסקטופ", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/about");
    const link = page.locator("header").getByRole("link", { name: "לתרומות" });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/donations");
  });

  test("במובייל הכפתור בראש תפריט הצד וההרשמה נשארת גלויה", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("/about");
    await expect(
      page.locator("header").getByRole("link", { name: "הרשמה חינם" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "תפריט" }).click();
    await expect(
      page.getByRole("dialog").getByRole("link", { name: "לתרומות" }),
    ).toHaveAttribute("href", "/donations");
  });

  test("הפוטר מכיל קישור לתרומות והנצחות", async ({ page }) => {
    await page.goto("/about");
    await expect(
      page.locator("footer").getByRole("link", { name: "תרומות והנצחות" }),
    ).toHaveAttribute("href", "/donations");
  });
});

test.describe("כוונת תרומה מהשרת", () => {
  test("Param2 ו-CallBack מגיעים מהשרת, ו-Back יוצר כוונה חדשה", async ({
    page,
  }) => {
    const issued: IntentStub[] = [];
    await openDonationPage(page);
    await stubIntent(page, () => {
      const intent = {
        id: crypto.randomUUID(),
        callbackUrl: "https://example.org/api/v1/donations/nedarim-callback",
      };
      issued.push(intent);
      return intent;
    });

    await page.getByRole("button", { name: CONTINUE_BUTTON }).click();
    await expect(page.locator("#NedarimFrame")).toBeVisible();
    await expect.poll(async () => (await received(page)).length).toBe(1);
    const [first] = await received(page);
    expect(first.data.Value).toMatchObject({
      Param2: issued[0].id,
      CallBack: issued[0].callbackUrl,
    });

    await emit(page, { Name: "Back" });
    await page.getByRole("button", { name: CONTINUE_BUTTON }).click();
    await expect.poll(async () => (await received(page)).length).toBe(2);
    const second = (await received(page))[1];
    expect(issued).toHaveLength(2);
    expect(issued[1].id).not.toBe(issued[0].id);
    expect(second.data.Value).toMatchObject({ Param2: issued[1].id });
  });

  test("בלי callbackUrl (localhost) לא נשלח CallBack", async ({ page }) => {
    await openDonationPage(page);
    await page.getByRole("button", { name: CONTINUE_BUTTON }).click();
    await expect.poll(async () => (await received(page)).length).toBe(1);
    const [message] = await received(page);
    expect(message.data.Value).not.toHaveProperty("CallBack");
  });

  test("כשל ביצירת הכוונה מציג שגיאה ונשאר בטופס", async ({ page }) => {
    await openDonationPage(page);
    await page.route(INTENT_ROUTE, (route) =>
      route.fulfill({ status: 500, json: { error: "x" } }),
    );
    await page.getByRole("button", { name: CONTINUE_BUTTON }).click();

    await expect(page.getByTestId("donation-submit-error")).toContainText(
      "לא הצלחנו",
    );
    await expectFrameHidden(page);
    await expect(
      page.getByRole("button", { name: CONTINUE_BUTTON }),
    ).toBeEnabled();
    expect(await received(page)).toHaveLength(0);
  });

  test("אחרי תודה, אישור מהשרת מחליף את 'בעיבוד' ב'התקבלה ונרשמה'", async ({
    page,
  }) => {
    await openDonationPage(page);
    await page.route(STATUS_ROUTE, (route) =>
      route.fulfill({ json: { status: "paid" } }),
    );
    await page.getByRole("button", { name: CONTINUE_BUTTON }).click();
    await expect(page.locator("#NedarimFrame")).toBeVisible();
    await emit(page, OK_MESSAGE);

    const line = page.getByTestId("donation-confirmation");
    await expect(line).toHaveText("התרומה בעיבוד");
    await expect(line).toHaveText("התרומה התקבלה ונרשמה", { timeout: 10_000 });
  });

  test("בלי אישור מהשרת נשארים ב'בעיבוד' ובלי שגיאה", async ({ page }) => {
    await openDonationPage(page);
    await page.route(STATUS_ROUTE, (route) =>
      route.fulfill({ json: { status: "pending" } }),
    );
    await page.getByRole("button", { name: CONTINUE_BUTTON }).click();
    await expect(page.locator("#NedarimFrame")).toBeVisible();
    await emit(page, OK_MESSAGE);

    await page.waitForTimeout(4_000);
    await expect(page.getByTestId("donation-confirmation")).toHaveText(
      "התרומה בעיבוד",
    );
    await expect(page.getByTestId("donation-submit-error")).toHaveCount(0);
  });
});
