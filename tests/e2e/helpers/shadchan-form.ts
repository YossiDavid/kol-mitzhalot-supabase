/**
 * מילוי שדות הזהות בטופס השדכן (שדכן/שדכנית, תאריך לידה, תמונה) ושאר שדות
 * החובה החדשים (עיר מגורים, סוג שידוכים, טלפון הרב), ועמודות מקבילות להכנסה
 * ישירה למסד. שדכן (male) חייב תמונה; שדכנית - רשות.
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

/** ערכי ברירת המחדל לשדות החובה שנוספו לטופס (עיר / סוג שידוכים / טלפון הרב) */
export const APPLICATION_EXTRAS = {
  city: "בני ברק",
  matchTypeLabel: "צעירים",
  rabbiPhone: "0527654321",
} as const;

/**
 * עמודות תקינות לבקשה ממתינה שנכתבת ישירות למסד (שדכנית - בלי תמונה): זהות,
 * ושאר העמודות שה-assert דורש מבקשה ממתינה.
 */
export const COMPLETE_IDENTITY_COLUMNS = {
  gender: "female",
  birth_date: ADULT_BIRTH_DATE,
  location: APPLICATION_EXTRAS.city,
  match_types: ["young"],
  rabbi_phone: APPLICATION_EXTRAS.rabbiPhone,
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

/** עיר מגורים, סוג שידוכים אחד וטלפון הרב */
export async function fillShadchanApplicationExtras(page: Page): Promise<void> {
  await page.getByLabel("עיר מגורים").fill(APPLICATION_EXTRAS.city);
  await page
    .getByRole("checkbox", { name: APPLICATION_EXTRAS.matchTypeLabel })
    .check();
  await page.getByLabel("טלפון של הרב").fill(APPLICATION_EXTRAS.rabbiPhone);
}

/**
 * ממלא מגדר ותאריך לידה; לשדכן (male) גם מעלה תמונה, אלא אם withAvatar=false.
 * ממלא גם את שדות החובה החדשים (fillShadchanApplicationExtras), אלא אם
 * withExtras=false.
 */
export async function fillShadchanIdentity(
  page: Page,
  {
    gender = "female",
    birthDate = ADULT_BIRTH_DATE,
    withAvatar = gender === "male",
    withExtras = true,
  }: {
    gender?: Gender;
    birthDate?: string;
    withAvatar?: boolean;
    withExtras?: boolean;
  } = {},
): Promise<void> {
  await page
    .getByRole("radio", { name: GENDER_LABEL[gender], exact: true })
    .check();
  await page.getByLabel("תאריך לידה").fill(birthDate);
  if (withAvatar) await uploadShadchanAvatar(page);
  if (withExtras) await fillShadchanApplicationExtras(page);
}
