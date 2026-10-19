import type { Page } from "@playwright/test";

/** PNG של פיקסל אחד - מספיק לגלריה (הדחיסה בלקוח אינה מגדילה אותו) */
const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/**
 * מוסיף תמונה לגלריה בשלב "פרטים אישיים". בכרטיס של גבר התמונה חובה
 * (basic-information-step.ts), ולכן כל זרימת יצירה של גבר עוברת כאן.
 */
export async function addStudentPhoto(page: Page): Promise<void> {
  await page.getByLabel("בחירת תמונות").first().setInputFiles({
    name: "photo.png",
    mimeType: "image/png",
    buffer: ONE_PIXEL_PNG,
  });
  await page.getByAltText("תמונה חדשה 1").first().waitFor();
}
