/**
 * Callers: Playwright `chromium-admin` project (מנהל מחובר).
 * מחירי פרנס בניהול ההקדשות: שמירה ומחיקה (ולידציה במינימום התרומה), והשפעה
 * מיידית על הקובייה הפנויה בדף הבית (קישור לרכישה + מחיר, הפקעת תג הקאש).
 * בנוסף: עמודת "פרנס" בניהול התרומות, וסימון "נדרשת בדיקה" על הקדשה שנרכשה
 * במשבצת תפוסה. מחירי הפרנס במסד נשמרים לפני הריצה ומוחזרים בסופה.
 */
import { expect, test, type Page } from "@playwright/test";

import {
  deleteDedicationsByPrefix,
  israelToday,
  serviceClient,
} from "../helpers/dedications";

const PATH = "/app/admin/content/dedications";
const RUN = `prc${Date.now()}`;
const LOAD = { timeout: 15_000 };
const DESKTOP = { width: 1440, height: 900 };
/** הפקעת תג הקאש: שניות בודדות, לא ה-revalidate של דקה */
const PUBLIC_PROPAGATION_MS = 6_000;
/**
 * מחיקת המחירים ב-beforeAll ישירה במסד (בלי הפקעת תג), ומחירים שספק אחר כתב
 * כך (dedication-purchase) עשויים להישאר בקאש עד ה-revalidate של דקה ועוד מרווח
 */
const PRICES_CACHE_POLL_TIMEOUT_MS = 90_000;
const PRICE = 540;
const today = israelToday();

const db = serviceClient();
let savedPrices: { kind: string; amount: number }[] = [];
const donationIds: string[] = [];

async function restorePrices() {
  await db.from("dedication_prices").delete().neq("kind", "");
  if (savedPrices.length > 0) {
    await db.from("dedication_prices").insert(savedPrices);
  }
}

async function openAdmin(page: Page) {
  await page.setViewportSize(DESKTOP);
  await page.goto(PATH);
  await expect(
    page.getByRole("heading", { name: "הקדשות והנצחות", level: 1 }),
  ).toBeVisible(LOAD);
  await expect(page.getByTestId("dedication-prices-summary")).toBeVisible(LOAD);
}

/** ה-href של כפתור "פנוי" של פרנס היום בדף הבית, אחרי טעינה מחדש עד שמתקבל הצפוי */
async function expectDayTileHref(
  page: Page,
  expected: string,
  timeout = PUBLIC_PROPAGATION_MS,
) {
  await expect
    .poll(
      async () => {
        await page.goto("/");
        const tile = page.getByTestId("dedication-available-sponsor_day");
        await tile.waitFor({ state: "visible" });
        return tile.getByRole("link").getAttribute("href");
      },
      { timeout, intervals: [300, 700, 1000] },
    )
    .toBe(expected);
}

test.describe.configure({ mode: "serial" });

test.describe("מחירי פרנס (ניהול)", () => {
  test.beforeAll(async () => {
    const { data } = await db.from("dedication_prices").select("kind, amount");
    savedPrices = data ?? [];
    await db.from("dedication_prices").delete().neq("kind", "");
  });

  test.afterAll(async () => {
    await restorePrices();
    await deleteDedicationsByPrefix(RUN);
    if (donationIds.length > 0) {
      await db.from("dedications").delete().in("donation_id", donationIds);
      await db.from("donations").delete().in("id", donationIds);
    }
  });

  test("בלי מחירים: הודעה בניהול, והקובייה בדף הבית מפנה לתרומה רגילה", async ({
    page,
  }) => {
    test.setTimeout(PRICES_CACHE_POLL_TIMEOUT_MS + 30_000);
    await openAdmin(page);
    await expect(page.getByTestId("dedication-prices-summary")).toContainText(
      "לא הוגדרו מחירי פרנס",
    );
    await expectDayTileHref(
      page,
      "/donations#donate",
      PRICES_CACHE_POLL_TIMEOUT_MS,
    );
  });

  test("מחיר מתחת ל-101 נדחה; מחיר תקין נשמר, ובדף הבית הקובייה מפנה לרכישה עם המחיר", async ({
    page,
  }) => {
    await openAdmin(page);
    await page.getByRole("button", { name: "מחירי פרנס" }).click();
    const prices = page.getByTestId("dedication-prices");
    await prices.getByLabel("פרנס היום (₪)").fill("100");
    await prices.getByRole("button", { name: "שמירת מחירים" }).click();
    await expect(prices.getByRole("alert")).toContainText("101");

    await prices.getByLabel("פרנס היום (₪)").fill(String(PRICE));
    await prices.getByRole("button", { name: "שמירת מחירים" }).click();
    await expect(page.getByTestId("dedication-prices-summary")).toContainText(
      `פרנס היום ${PRICE} ₪`,
      LOAD,
    );
    const { data } = await db.from("dedication_prices").select("kind, amount");
    expect(data).toEqual([{ kind: "sponsor_day", amount: PRICE }]);

    await expectDayTileHref(page, "/donations?dedication=sponsor_day#donate");
    await expect(page.getByTestId("dedication-price-sponsor_day")).toHaveText(
      `${PRICE} ₪`,
    );
  });

  test("ניקוי המחיר מחזיר את הקובייה לתרומה רגילה", async ({ page }) => {
    await openAdmin(page);
    await page.getByRole("button", { name: "מחירי פרנס" }).click();
    const prices = page.getByTestId("dedication-prices");
    await prices.getByLabel("פרנס היום (₪)").fill("");
    await prices.getByRole("button", { name: "שמירת מחירים" }).click();
    await expect(page.getByTestId("dedication-prices-summary")).toContainText(
      "לא הוגדרו מחירי פרנס",
      LOAD,
    );
    await expectDayTileHref(page, "/donations#donate");
  });

  test("תרומה שרכשה פרנס: עמודת 'פרנס' בניהול התרומות; הקדשה במשבצת תפוסה מסומנת לבדיקה", async ({
    page,
  }) => {
    const { data: donation, error } = await db
      .from("donations")
      .insert({
        amount: 7781,
        frequency: "one_time",
        status: "pending",
        dedication_type: "לזכות",
        dedication_name: `נועם ${RUN}`,
        donor_first_name: "בדיקה",
        donor_last_name: RUN,
        dedication_kind: "sponsor_week",
        dedication_starts_on: today,
        dedication_ends_on: today,
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    donationIds.push(donation!.id);
    await db.from("dedications").insert({
      kind: "sponsor_week",
      dedication_type: "לזכות",
      honoree: `נועם ${RUN}`,
      starts_on: today,
      ends_on: today,
      is_published: false,
      needs_review: true,
      donation_id: donation!.id,
    });

    await page.setViewportSize(DESKTOP);
    await page.goto("/app/admin/donations");
    const row = page.getByRole("row").filter({ hasText: "7,781" });
    await expect(row.getByTestId("donation-purchase")).toContainText(
      "פרנס השבוע",
      LOAD,
    );
    await expect(row.getByTestId("donation-purchase")).toContainText(
      "ממתינה לבדיקה",
    );

    await openAdmin(page);
    const dedicationRow = page
      .getByRole("row")
      .filter({ hasText: `נועם ${RUN}` });
    await expect(
      dedicationRow.getByTestId("dedication-purchased"),
    ).toBeVisible();
    await expect(
      dedicationRow.getByTestId("dedication-needs-review"),
    ).toBeVisible();

    // פרסום הוא החלטת המנהל: מנקה את הסימון
    await dedicationRow
      .getByRole("button", { name: new RegExp(`^פרסום: נועם ${RUN}`) })
      .click();
    await expect(
      dedicationRow.getByTestId("dedication-needs-review"),
    ).toHaveCount(0, LOAD);
  });
});
