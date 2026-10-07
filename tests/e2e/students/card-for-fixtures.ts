import { expect, type Page } from "@playwright/test";

/**
 * שאלת "מי ממלא את הכרטיס?" בשלב ההקדמה. הורה: קשר (אב/אם), שם וטלפון
 * חובה כבר בשלב הזה; אדם אחר: קשר, שם, טלפון, "מכיר היטב" והסבר.
 */

export const CARD_FOR_LABELS = {
  self: "המועמד/ת בעצמו/ה",
  child: "אב או אם של המועמד/ת",
  other: "אדם אחר (שדכן/ית, קרוב/ת משפחה, מכר/ה)",
} as const;

export const FILLER_NAME = "ממלא בדיקה";
export const FILLER_PHONE = "0521234567";
export const FILL_REASON = "למועמד אין גישה למחשב";

/** בורר הקשר: ל-select אין id, ולכן נמצא לפי תא השדה */
export const relationSelect = (page: Page) =>
  page.locator('[data-field-name="author.relationType"] select');

export async function chooseChildCard(page: Page) {
  await page.getByRole("radio", { name: CARD_FOR_LABELS.child }).check();
  await relationSelect(page).selectOption("father");
  await page.locator("#author-name").fill(FILLER_NAME);
  await page.locator("#author-phone").fill(FILLER_PHONE);
}

export async function chooseThirdPartyCard(
  page: Page,
  options: { relationType?: string; knowsWell?: boolean } = {},
) {
  await page.getByRole("radio", { name: CARD_FOR_LABELS.other }).check();
  await relationSelect(page).selectOption(options.relationType ?? "shadchan");
  await page.locator("#author-name").fill(FILLER_NAME);
  await page.locator("#author-phone").fill(FILLER_PHONE);
  await page
    .locator('[data-field-name="author.knowsWell"]')
    .getByRole("radio", { name: options.knowsWell === false ? "לא" : "כן" })
    .check();
  await page.locator("#author-fillReason").fill(FILL_REASON);
  await expect(page.locator("#author-fillReason")).toHaveValue(FILL_REASON);
}
