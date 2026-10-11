import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { setShadchanApproval } from "../forums/forum-fixtures";
import { createServiceClient, getTestUserId } from "../shidduchim/fixtures";
import { PAGE_SIZE, runToken, twoDigits } from "./paging-fixtures";

/**
 * עימוד ברשימת הפורום: 23 פוסטים בנושא ייעודי להרצה (אחד מהם מוצמד והוא הישן
 * ביותר). מוצמד קודם, אחריו החדשים; עמוד 2 מחזיק את 3 הישנים. הנושא הייעודי
 * מבודד את הבדיקה משאר הפוסטים שבמסד.
 */
const POST_COUNT = 23;
const PINNED_INDEX = POST_COUNT - 1;
const LOAD_TIMEOUT = 15_000;
const MINUTE_MS = 60_000;

test.describe.configure({ mode: "serial" });

const token = runToken();
const categorySlug = `paging-${token}`;
const categoryName = `נושא עימוד ${token}`;
const titleOf = (index: number) => `פוסט עימוד ${token} ${twoDigits(index)}`;

let admin: SupabaseClient;
let userId: string;
let categoryId: string;
/** מצב האישור לפני הבדיקה, לשחזור: null = לא הייתה שורה */
let previousApproval: string | null = null;

/** סדר התצוגה: המוצמד, ואז החדשים (אינדקס נמוך = חדש) בלי המוצמד */
const displayOrder = [
  PINNED_INDEX,
  ...Array.from({ length: PINNED_INDEX }, (_, i) => i),
];

const range = (page: Page) =>
  page.locator('[data-testid="list-range"]:visible');
const postTitles = (page: Page) => page.getByTestId("forum-post").locator("h2");

test.beforeAll(async () => {
  admin = createServiceClient();
  userId = await getTestUserId(admin);

  const { data: info } = await admin
    .from("shadchanim_info")
    .select("application_status")
    .eq("user_id", userId)
    .maybeSingle();
  previousApproval = (info?.application_status as string | undefined) ?? null;
  await setShadchanApproval(admin, userId, "approved");

  const { data: category, error: categoryError } = await admin
    .from("forum_categories")
    .insert({ name: categoryName, slug: categorySlug, sort_order: 9999 })
    .select("id")
    .single();
  if (categoryError || !category) {
    throw new Error(`יצירת נושא נכשלה: ${categoryError?.message}`);
  }
  categoryId = category.id as string;

  const base = Date.now() - 60 * MINUTE_MS;
  const rows = Array.from({ length: POST_COUNT }, (_, index) => ({
    author_id: userId,
    category_id: categoryId,
    title: titleOf(index),
    content: "תוכן לבדיקת עימוד",
    created_at: new Date(base - index * MINUTE_MS).toISOString(),
    is_pinned: index === PINNED_INDEX,
  }));
  const { error } = await admin.from("forum_posts").insert(rows);
  if (error) throw new Error(`יצירת פוסטים נכשלה: ${error.message}`);
});

test.afterAll(async () => {
  await admin.from("forum_posts").delete().eq("category_id", categoryId);
  await admin.from("forum_categories").delete().eq("id", categoryId);
  if (previousApproval === null) {
    await admin.from("shadchanim_info").delete().eq("user_id", userId);
  } else {
    await admin
      .from("shadchanim_info")
      .update({ application_status: previousApproval })
      .eq("user_id", userId);
  }
});

test("עמוד ראשון בנושא: מוצמד קודם, אחריו החדשים, עם הסך הכל", async ({
  page,
}) => {
  await page.goto(`/app/forums?cat=${categorySlug}`);

  await expect(range(page)).toHaveText(
    `מציג 1–${PAGE_SIZE} מתוך ${POST_COUNT}`,
    {
      timeout: LOAD_TIMEOUT,
    },
  );
  await expect(postTitles(page)).toHaveCount(PAGE_SIZE);
  await expect(postTitles(page)).toHaveText(
    displayOrder.slice(0, PAGE_SIZE).map(titleOf),
  );
});

test("עמוד 2 מציג את הפוסטים הישנים ביותר, והנושא נשמר בכתובת", async ({
  page,
}) => {
  await page.goto(`/app/forums?cat=${categorySlug}`);
  await expect(range(page)).toBeVisible({ timeout: LOAD_TIMEOUT });

  await page.getByRole("link", { name: "עמוד 2", exact: true }).click();

  await expect(page).toHaveURL(
    new RegExp(`cat=${categorySlug}.*page=2|page=2.*cat=${categorySlug}`),
  );
  await expect(range(page)).toHaveText(
    `מציג ${PAGE_SIZE + 1}–${POST_COUNT} מתוך ${POST_COUNT}`,
    { timeout: LOAD_TIMEOUT },
  );
  await expect(postTitles(page)).toHaveText(
    displayOrder.slice(PAGE_SIZE).map(titleOf),
  );
});

test("החלפת נושא מחזירה לעמוד הראשון", async ({ page }) => {
  await page.goto(`/app/forums?cat=${categorySlug}&page=2`);
  await expect(range(page)).toHaveText(
    `מציג ${PAGE_SIZE + 1}–${POST_COUNT} מתוך ${POST_COUNT}`,
    { timeout: LOAD_TIMEOUT },
  );

  const filters = page.getByRole("navigation", { name: "סינון לפי נושא" });
  await filters.getByRole("link", { name: "הכל" }).click();
  await expect(page).not.toHaveURL(/page=/);
  await filters.getByRole("link", { name: categoryName }).click();

  await expect(page).not.toHaveURL(/page=/);
  await expect(range(page)).toHaveText(
    `מציג 1–${PAGE_SIZE} מתוך ${POST_COUNT}`,
    {
      timeout: LOAD_TIMEOUT,
    },
  );
});

test("עמוד שאחרי הסוף מציג את העמוד האחרון", async ({ page }) => {
  await page.goto(`/app/forums?cat=${categorySlug}&page=50`);

  await expect(range(page)).toHaveText(
    `מציג ${PAGE_SIZE + 1}–${POST_COUNT} מתוך ${POST_COUNT}`,
    { timeout: LOAD_TIMEOUT },
  );
  await expect(postTitles(page)).toHaveCount(POST_COUNT - PAGE_SIZE);
});
