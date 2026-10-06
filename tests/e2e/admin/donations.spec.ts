/**
 * Callers: Playwright `chromium-admin` project (מנהל מחובר).
 * עמוד התרומות לניהול: טבלה, סטטוסים, סינון, מספר חיובים בהוראת קבע ורשימת
 * תשלומים שלא הותאמו. הנתונים נזרעים בשירות (service role) וקריאת העמוד היא דרך RLS.
 */
import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "../shidduchim/fixtures";

const PATH = "/app/admin/donations";
const RUN = `adm${Date.now()}`;

test.describe("תרומות (ניהול)", () => {
  let db: SupabaseClient;
  const donationIds: string[] = [];
  const orphanTx = `${RUN}-orphan`;

  test.beforeAll(async () => {
    db = createServiceClient();
    const rows = [
      {
        amount: 7771,
        frequency: "one_time",
        status: "paid",
        donor_first_name: "דנה",
        donor_last_name: `בדיקה${RUN}`,
        dedication_text: "לזכות בדיקה",
        // ניסיון כושל שקדם לתשלום: לא מוצג אחרי ששולם
        last_error: "NEED ZEOUT",
        last_error_at: new Date().toISOString(),
      },
      { amount: 7772, frequency: "monthly", status: "pending" },
      { amount: 7773, frequency: "one_time", status: "mismatch" },
      { amount: 7774, frequency: "one_time", status: "pending" },
      {
        amount: 7776,
        frequency: "monthly",
        status: "pending",
        provider_keva_id: `${RUN}-keva`,
      },
      {
        amount: 7775,
        frequency: "one_time",
        status: "pending",
        last_error: "NEED ZEOUT",
        last_error_at: new Date().toISOString(),
      },
    ];
    const { data, error } = await db
      .from("donations")
      .insert(rows)
      .select("id, amount");
    expect(error).toBeNull();
    donationIds.push(...data!.map((row) => row.id));

    const monthly = data!.find((row) => row.amount === 7772)!;
    const payments = [0, 1].map((index) => ({
      donation_id: monthly.id,
      kind: "transaction",
      provider_transaction_id: `${RUN}-m${index}`,
      amount: 7772,
      currency: 1,
      matched: true,
      is_temporary: false,
      raw: { RunTag: RUN },
    }));
    const temporary = data!.find((row) => row.amount === 7774)!;
    const { error: paymentsError } = await db.from("donation_payments").insert([
      ...payments,
      {
        donation_id: temporary.id,
        kind: "transaction",
        provider_transaction_id: `${RUN}-temp`,
        amount: 7774,
        currency: 1,
        matched: true,
        is_temporary: true,
        raw: { RunTag: RUN },
      },
      {
        kind: "transaction",
        provider_transaction_id: orphanTx,
        amount: 55,
        currency: 1,
        matched: false,
        is_temporary: false,
        mismatch_reason: "unknown_reference",
        raw: { RunTag: RUN, ClientName: "תורם לא מוכר" },
      },
    ]);
    expect(paymentsError).toBeNull();
  });

  test.afterAll(async () => {
    await db
      .from("donation_payments")
      .delete()
      .like("provider_transaction_id", `${RUN}%`);
    await db.from("donations").delete().in("id", donationIds);
  });

  test("מציג תרומות עם סטטוס, תורם, מספר חיובים ותשלום לא מותאם", async ({
    page,
  }) => {
    await page.goto(PATH);
    await expect(
      page.getByRole("heading", { name: "תרומות", level: 1 }),
    ).toBeVisible();

    const table = page.getByRole("table", { name: "רשימת התרומות" });
    const paidRow = table.getByRole("row").filter({ hasText: "7,771" });
    await expect(paidRow).toContainText("שולם");
    await expect(paidRow).toContainText(`דנה בדיקה${RUN}`);
    await expect(paidRow).toContainText("לזכות בדיקה");

    const monthlyRow = table.getByRole("row").filter({ hasText: "7,772" });
    await expect(monthlyRow).toContainText("ממתין");
    await expect(monthlyRow).toContainText("חודשית");
    await expect(monthlyRow.getByRole("cell").last()).toHaveText("2");

    await expect(
      table.getByRole("row").filter({ hasText: "7,773" }),
    ).toContainText("אי-התאמה");

    // עסקה זמנית בלבד: ממתין לאישור סליקה, ולא ברשימת הלא-מותאמים
    const temporaryRow = table.getByRole("row").filter({ hasText: "7,774" });
    await expect(temporaryRow).toContainText("ממתין לאישור סליקה");
    await expect(monthlyRow).not.toContainText("ממתין לאישור סליקה");

    // ניסיון תשלום שנכשל מוצג כהערה עמומה רק לתרומה שעדיין ממתינה
    const failedRow = table.getByRole("row").filter({ hasText: "7,775" });
    await expect(failedRow).toContainText("ממתין");
    await expect(failedRow.getByTestId("donation-last-error")).toContainText(
      "ניסיון תשלום נכשל: NEED ZEOUT",
    );
    await expect(paidRow).not.toContainText("ניסיון תשלום נכשל");

    // הוראת קבע שהוקמה וממתינה לחיוב הראשון; ו-7772 (עם חיובים) לא
    const kevaRow = table.getByRole("row").filter({ hasText: "7,776" });
    await expect(
      kevaRow.getByTestId("donation-awaiting-first-charge"),
    ).toContainText("הוראת קבע הוקמה, ממתין לחיוב ראשון");
    await expect(monthlyRow).not.toContainText("ממתין לחיוב ראשון");

    const unmatched = page.getByTestId("donations-unmatched");
    await expect(unmatched).not.toContainText(`${RUN}-temp`);
    await expect(unmatched).toContainText("תורם לא מוכר");
    await expect(unmatched).toContainText("unknown_reference");
  });

  test("סינון לפי סטטוס", async ({ page }) => {
    await page.goto(`${PATH}?status=mismatch`);
    const table = page.getByRole("table", { name: "רשימת התרומות" });
    await expect(
      table.getByRole("row").filter({ hasText: "7,773" }),
    ).toBeVisible();
    await expect(
      table.getByRole("row").filter({ hasText: "7,771" }),
    ).toHaveCount(0);

    await page
      .getByTestId("donations-filters")
      .getByRole("link", { name: "שולם" })
      .click();
    await expect(page).toHaveURL(/status=paid/);
    await expect(
      page
        .getByRole("table", { name: "רשימת התרומות" })
        .getByRole("row")
        .filter({ hasText: "7,771" }),
    ).toBeVisible();
  });

  test("הקישור מדף הניהול", async ({ page }) => {
    await page.goto("/app/admin");
    await page.locator(`a[href="${PATH}"]`).click();
    await expect(page).toHaveURL(new RegExp(PATH));
  });
});
