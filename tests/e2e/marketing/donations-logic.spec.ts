/**
 * Callers: Playwright `marketing` project. בדיקות יחידה (ללא שרת) לצד השרת של התרומות:
 * אימות חתימת ה-webhook (כולל החישוב של הספק), פענוח סלחני, וולידציית הכוונה,
 * כתובת ה-CallBack והגבלת הקצב.
 */
import { createHmac } from "node:crypto";
import { test, expect } from "@playwright/test";
import {
  buildCallbackUrl,
  NEDARIM_CALLBACK_PATH,
} from "@/features/donations/lib/callback-url";
import {
  toDonationInsert,
  validateDonationIntent,
} from "@/features/donations/lib/intent";
import {
  NON_CARD_SOLEKS,
  parseAmount,
  parseNedarimCallback,
} from "@/features/donations/lib/parse-callback";
import {
  MAX_TIMESTAMP_SKEW_SECONDS,
  computeSignature,
  verifyNedarimSignature,
} from "@/features/donations/lib/verify-webhook";
import { createRateLimiter } from "@/lib/rate-limit";

const SECRET = "test-secret-1";
const OLD_SECRET = "test-secret-old";
const NOW = 1_800_000_000;
const BODY = '{"TransactionId":"123","Amount":"180","Param2":"abc"}';

const verify = (
  overrides: Partial<Parameters<typeof verifyNedarimSignature>[0]> = {},
) =>
  verifyNedarimSignature({
    secrets: [SECRET],
    timestampHeader: String(NOW),
    signatureHeader: computeSignature(SECRET, String(NOW), BODY),
    rawBody: BODY,
    nowSeconds: NOW,
    ...overrides,
  });

test.describe("אימות חתימת webhook", () => {
  test("החישוב זהה לדוגמת הספק (createHmac על timestamp.rawBody)", () => {
    const expected = createHmac("sha256", SECRET)
      .update(`${NOW}.${BODY}`)
      .digest("hex");
    expect(computeSignature(SECRET, String(NOW), BODY)).toBe(`v1=${expected}`);
    expect(verify()).toEqual({ ok: true });
  });

  test("סוד שגוי נדחה", () => {
    expect(verify({ secrets: ["other"] })).toEqual({
      ok: false,
      reason: "bad_signature",
    });
  });

  test("גוף ששונה (גם רווח אחד) נדחה", () => {
    expect(verify({ rawBody: `${BODY} ` })).toMatchObject({ ok: false });
    expect(verify({ rawBody: BODY.replace("180", "181") })).toMatchObject({
      ok: false,
      reason: "bad_signature",
    });
  });

  test("כותרות חסרות נדחות", () => {
    expect(verify({ signatureHeader: null })).toEqual({
      ok: false,
      reason: "missing_headers",
    });
    expect(verify({ timestampHeader: null })).toEqual({
      ok: false,
      reason: "missing_headers",
    });
  });

  test("חותמת זמן מחוץ לחלון של 5 דקות נדחית, גם עם חתימה נכונה", () => {
    const stale = String(NOW - MAX_TIMESTAMP_SKEW_SECONDS - 1);
    expect(
      verify({
        timestampHeader: stale,
        signatureHeader: computeSignature(SECRET, stale, BODY),
      }),
    ).toEqual({ ok: false, reason: "stale_timestamp" });
    const future = String(NOW + MAX_TIMESTAMP_SKEW_SECONDS + 1);
    expect(
      verify({
        timestampHeader: future,
        signatureHeader: computeSignature(SECRET, future, BODY),
      }),
    ).toMatchObject({ ok: false, reason: "stale_timestamp" });
    const edge = String(NOW - MAX_TIMESTAMP_SKEW_SECONDS);
    expect(
      verify({
        timestampHeader: edge,
        signatureHeader: computeSignature(SECRET, edge, BODY),
      }),
    ).toEqual({ ok: true });
  });

  test("חותמת זמן לא מספרית נדחית", () => {
    expect(verify({ timestampHeader: "abc" })).toEqual({
      ok: false,
      reason: "bad_timestamp",
    });
  });

  test("חתימה בפורמט שגוי נדחית (אורך, קידומת)", () => {
    for (const signatureHeader of ["v1=abc", "abc", "v2=" + "a".repeat(64)]) {
      expect(verify({ signatureHeader })).toEqual({
        ok: false,
        reason: "bad_signature",
      });
    }
  });

  test("בלי סוד מוגדר נכשל סגור, גם עם חתימה 'נכונה'", () => {
    for (const secrets of [[], [undefined], [""], ["  "], [null, undefined]]) {
      expect(verify({ secrets })).toEqual({
        ok: false,
        reason: "not_configured",
      });
    }
  });

  test("החלפת מפתח: הישן והחדש מתקבלים, אחר לא", () => {
    const signedWithOld = computeSignature(OLD_SECRET, String(NOW), BODY);
    expect(
      verify({ secrets: [SECRET, OLD_SECRET], signatureHeader: signedWithOld }),
    ).toEqual({ ok: true });
    expect(verify({ secrets: [SECRET, OLD_SECRET] })).toEqual({ ok: true });
    expect(
      verify({ secrets: [SECRET, undefined], signatureHeader: signedWithOld }),
    ).toMatchObject({ ok: false });
  });

  test("חתימה באותיות גדולות בהקסה מתקבלת", () => {
    const signature = computeSignature(SECRET, String(NOW), BODY);
    expect(
      verify({ signatureHeader: `v1=${signature.slice(3).toUpperCase()}` }),
    ).toEqual({ ok: true });
  });
});

test.describe("פענוח סלחני של ה-webhook", () => {
  test("עסקה: מפתחות בכל רישיות, מספרים ומחרוזות, מפתחות לא מוכרים", () => {
    const parsed = parseNedarimCallback(
      JSON.stringify({
        transactionid: 987,
        PARAM2: " 5b0e0000-0000-4000-8000-000000000000 ",
        Amount: "1,000.50",
        Currency: 1,
        Confirmation: "",
        LastNum: "1234",
        KevaId: "55",
        TransactionTime: "05/10/2026 10:11:12",
        BrandNewField: { nested: true },
      }),
    );
    expect(parsed).toEqual({
      kind: "transaction",
      transactionId: "987",
      kevaId: "55",
      param2: "5b0e0000-0000-4000-8000-000000000000",
      amount: 1000.5,
      currency: 1,
      confirmation: null,
      solek: null,
      // כרטיס אשראי (אין Solek) בלי אישור = זמנית
      isTemporary: true,
      last4: "1234",
      transactionTime: "05/10/2026 10:11:12",
    });
  });

  test("Confirmation חסר, ריק, רווחים או 0 הוא עסקה זמנית; אישור אמיתי לא", () => {
    const temporaryOf = (extra: string) =>
      parseNedarimCallback(`{"TransactionId":"1"${extra}}`)?.isTemporary;
    for (const extra of [
      "",
      ',"Confirmation":""',
      ',"Confirmation":"  "',
      ',"Confirmation":"0"',
      ',"Confirmation":0',
      ',"Confirmation":null',
    ]) {
      expect(temporaryOf(extra), extra).toBe(true);
    }
    for (const extra of [',"Confirmation":"0123456"', ',"Confirmation":8812']) {
      expect(temporaryOf(extra), extra).toBe(false);
    }
    expect(
      parseNedarimCallback('{"TransactionId":"1","Confirmation":"0"}')
        ?.confirmation,
    ).toBeNull();
  });

  test("סולקים שאינם אשראי (27-31, מספר או מחרוזת) אינם דורשים Confirmation", () => {
    expect([...NON_CARD_SOLEKS].sort()).toEqual([27, 28, 29, 30, 31]);
    for (const solek of ["27", 27, " 30 ", 31]) {
      const parsed = parseNedarimCallback(
        JSON.stringify({ TransactionId: "1", Solek: solek }),
      );
      expect(parsed?.isTemporary, String(solek)).toBe(false);
    }
    for (const solek of ["1", 2, "6", "7", "abc", ""]) {
      const parsed = parseNedarimCallback(
        JSON.stringify({ TransactionId: "1", Solek: solek }),
      );
      expect(parsed?.isTemporary, String(solek)).toBe(true);
    }
  });

  test("הקמת הוראת קבע אינה עסקה זמנית (אינה חיוב)", () => {
    expect(
      parseNedarimCallback('{"KevaId":"77","Amount":360}')?.isTemporary,
    ).toBe(false);
  });

  test("הקמת הוראת קבע: אין TransactionId אבל יש KevaId", () => {
    expect(
      parseNedarimCallback('{"KevaId":"77","Amount":360,"Currency":"1"}'),
    ).toMatchObject({
      kind: "keva_created",
      transactionId: null,
      kevaId: "77",
      amount: 360,
      currency: 1,
    });
  });

  test("גוף לא תקין או לא מזוהה מחזיר null", () => {
    for (const body of [
      "",
      "not json",
      "[]",
      "5",
      "null",
      "{}",
      '{"Amount":1}',
    ]) {
      expect(parseNedarimCallback(body)).toBeNull();
    }
  });

  test("סכום ומטבע לא מזוהים הופכים ל-null (ולא ל-0)", () => {
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount(null)).toBeNull();
    expect(
      parseNedarimCallback('{"TransactionId":"1","Amount":"x","Currency":"9"}'),
    ).toMatchObject({ amount: null, currency: null });
  });
});

test.describe("וולידציית כוונת תרומה", () => {
  const valid = { amount: 180, frequency: "once" as const };

  test("כוונה תקינה ושורה להכנסה", () => {
    const result = validateDonationIntent({
      ...valid,
      frequency: "monthly",
      dedicationType: "לעילוי נשמת",
      dedicationName: " משה בן שרה ",
      firstName: "ישראל",
      email: "a@b.co",
      id: "client-supplied",
      callbackUrl: "https://evil.example",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).not.toHaveProperty("id");
    expect(toDonationInsert(result.data)).toMatchObject({
      amount: 180,
      currency: 1,
      frequency: "monthly",
      dedication_type: "לעילוי נשמת",
      dedication_name: "משה בן שרה",
      dedication_text: "לעילוי נשמת משה בן שרה",
      donor_first_name: "ישראל",
      donor_last_name: null,
      donor_email: "a@b.co",
    });
  });

  test("חד-פעמית בלי הקדשה", () => {
    const result = validateDonationIntent(valid);
    expect(result.ok && toDonationInsert(result.data)).toMatchObject({
      frequency: "one_time",
      dedication_text: null,
    });
  });

  test("אותם כללים כמו בטופס: סכום, קישור, טלפון, מייל, אורך, סוג הקדשה", () => {
    const invalid: unknown[] = [
      null,
      "x",
      {},
      { ...valid, amount: 5 },
      { ...valid, amount: 50_001 },
      { ...valid, amount: 10.5 },
      { ...valid, amount: "180" },
      { ...valid, frequency: "weekly" },
      { ...valid, dedicationType: "לזכות", dedicationName: "http://x.co" },
      { ...valid, dedicationType: "לזכות", dedicationName: "  " },
      { ...valid, dedicationType: "evil", dedicationName: "x" },
      { ...valid, phone: "abc" },
      { ...valid, email: "nope" },
      { ...valid, firstName: "א".repeat(61) },
      { ...valid, dedicationName: "א".repeat(81) },
    ];
    for (const payload of invalid) {
      expect(validateDonationIntent(payload).ok, JSON.stringify(payload)).toBe(
        false,
      );
    }
  });
});

test.describe("כתובת CallBack", () => {
  test("רק origin ציבורי ב-https", () => {
    expect(buildCallbackUrl("https://kol-mitzhalot.org.il/")).toBe(
      `https://kol-mitzhalot.org.il${NEDARIM_CALLBACK_PATH}`,
    );
    for (const origin of [
      "http://kol-mitzhalot.org.il",
      "http://localhost:3000",
      "https://localhost",
      "https://127.0.0.1",
      "https://192.168.1.5",
      "https://myhost",
      "https://thing.local",
      "garbage",
      "",
    ]) {
      expect(buildCallbackUrl(origin), origin).toBeNull();
    }
  });
});

test.describe("הגבלת קצב", () => {
  test("חוסם מעל המכסה בחלון ומשחרר אחריו, לכל מפתח בנפרד", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000 });
    expect(limiter.allow("a", 0)).toBe(true);
    expect(limiter.allow("a", 1)).toBe(true);
    expect(limiter.allow("a", 2)).toBe(false);
    expect(limiter.allow("b", 2)).toBe(true);
    expect(limiter.allow("a", 1001)).toBe(true);
  });
});
