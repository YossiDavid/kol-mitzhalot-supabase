import { expect, type Page } from "@playwright/test";

/**
 * אחרי שליחת כרטיס חדש מוצגת הזמנה לתרום (DonationAfterSubmitDialog), ורק
 * "המשך לכרטיס" מעביר לדף הכרטיס. ממתין לדיאלוג (השמירה עצמה אורכת זמן).
 */
export async function continuePastDonationDialog(
  page: Page,
  timeout: number,
): Promise<void> {
  const dialog = page.getByTestId("donation-after-submit");
  await expect(dialog).toBeVisible({ timeout });
  await dialog.getByRole("button", { name: "המשך לכרטיס" }).click();
}
