/**
 * מילוי שדות הזהות בטופס השדכן (שדכן/שדכנית, תאריך לידה, תמונה), ועמודות
 * מקבילות להכנסה ישירה למסד. שדכן (male) חייב תמונה; שדכנית - רשות.
 * Callers: settings/shadchan-*.spec.ts, settings/application-*.spec.ts,
 * admin/shadchan-*.spec.ts.
 */
import { expect, type Page } from "@playwright/test";

/** PNG שקוף 1x1 - מספיק כדי לעבור את בדיקות הסוג והגודל */
export const TINY_PNG = {
  name: "avatar.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64",
  ),
};

/** תאריך לידה של בן/בת 40 - תמיד בטווח 18-100 */
export const ADULT_BIRTH_DATE = `${new Date().getFullYear() - 40}-01-01`;

/** עמודות זהות תקינות לבקשה ממתינה שנכתבת ישירות למסד (שדכנית - בלי תמונה) */
export const COMPLETE_IDENTITY_COLUMNS = {
  gender: "female",
  birth_date: ADULT_BIRTH_DATE,
} as const;

type Gender = "male" | "female";

const GENDER_LABEL: Record<Gender, string> = {
  male: "שדכן",
  female: "שדכנית",
};

export async function uploadShadchanAvatar(page: Page): Promise<void> {
  await page.getByTestId("shadchan-avatar-input").setInputFiles(TINY_PNG);
  await expect(page.getByRole("button", { name: "החלפת תמונה" })).toBeVisible({
    timeout: 15_000,
  });
}

/** ממלא מגדר ותאריך לידה; לשדכן (male) גם מעלה תמונה, אלא אם withAvatar=false */
export async function fillShadchanIdentity(
  page: Page,
  {
    gender = "female",
    birthDate = ADULT_BIRTH_DATE,
    withAvatar = gender === "male",
  }: { gender?: Gender; birthDate?: string; withAvatar?: boolean } = {},
): Promise<void> {
  await page
    .getByRole("radio", { name: GENDER_LABEL[gender], exact: true })
    .check();
  await page.getByLabel("תאריך לידה").fill(birthDate);
  if (withAvatar) await uploadShadchanAvatar(page);
}
