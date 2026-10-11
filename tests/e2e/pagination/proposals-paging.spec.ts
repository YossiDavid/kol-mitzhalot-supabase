import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { ensureSecondParentId } from "../chats/context-fixtures";
import { createServiceClient } from "../shidduchim/fixtures";
import {
  PAGE_SIZE,
  PAGING_PARENT,
  PAGING_SHADCHAN,
  ensureDedicatedUser,
  insertCards,
  runToken,
  seedProposals,
  twoDigits,
} from "./paging-fixtures";
import { pageAs } from "../chats/context-fixtures";

/**
 * עימוד בשרת של "הצעות שקיבלתי" (הורה), "כל השידוכים שלי" ו"הצעות שמורות"
 * (שדכן). 25 הצעות שנשלחו ו-23 טיוטות, מול כלות עם שם ייחודי להרצה. המשתמשים
 * ייעודיים, ולכן הסך הכל הוא בדיוק מה שנזרע.
 */
const SENT_COUNT = 25;
const DRAFT_COUNT = 23;
const LOAD_TIMEOUT = 15_000;

test.describe.configure({ mode: "serial" });

let admin: SupabaseClient;
const token = runToken();
const brideName = (index: number) => `כלה${token}${twoDigits(index)}`;
let parentId: string;
let shadchanId: string;
let groomId: string;
let brideIds: string[] = [];
let parentPage: Page;
let shadchanPage: Page;

const names = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => brideName(from + i));

test.beforeAll(async ({ browser }) => {
  admin = createServiceClient();
  parentId = await ensureDedicatedUser(admin, PAGING_PARENT);
  shadchanId = await ensureDedicatedUser(admin, PAGING_SHADCHAN);
  const otherParentId = await ensureSecondParentId(admin);

  [groomId] = await insertCards(admin, [
    {
      userId: parentId,
      gender: "male",
      firstName: "חתן",
      lastName: `עימוד${token}`,
    },
  ]);
  brideIds = await insertCards(
    admin,
    Array.from({ length: SENT_COUNT + DRAFT_COUNT }, (_, index) => ({
      userId: otherParentId,
      gender: "female" as const,
      firstName: "כלה",
      lastName: brideName(index),
    })),
  );
  await seedProposals(admin, {
    shadchanId,
    groomId,
    brideIds: brideIds.slice(0, SENT_COUNT),
    status: "sent",
  });
  await seedProposals(admin, {
    shadchanId,
    groomId,
    brideIds: brideIds.slice(SENT_COUNT),
    status: "draft",
  });

  parentPage = await pageAs(browser, admin, PAGING_PARENT.email, "/app");
  shadchanPage = await pageAs(browser, admin, PAGING_SHADCHAN.email, "/app");
});

test.afterAll(async () => {
  await parentPage?.context().close();
  await shadchanPage?.context().close();
  // מחיקת הכרטיסים גוררת את ההצעות (cascade)
  await admin
    .from("students")
    .delete()
    .in("id", [groomId, ...brideIds]);
});

/** בניווט בין דפים הדף הקודם נשאר רגע בעץ (מוסתר); רק הנראה נחשב */
const range = (page: Page) =>
  page.locator('[data-testid="list-range"]:visible');

/** שם הכלה מופיע בכותרת (h3) של כל כרטיס; סופרים את אלה של הרצה זו */
const cardsOfRun = (page: Page) =>
  page.getByRole("heading", { level: 3 }).filter({ hasText: `כלה${token}` });

async function expectCardNames(page: Page, expected: string[]) {
  await expect(cardsOfRun(page)).toHaveCount(expected.length, {
    timeout: LOAD_TIMEOUT,
  });
  const texts = await cardsOfRun(page).allInnerTexts();
  expected.forEach((name, index) => expect(texts[index]).toContain(name));
}

test.describe("הצעות שקיבלתי (הורה)", () => {
  test("עמוד ראשון: 20 החדשות, הסך הכל, וללא 'הקודם'", async () => {
    await parentPage.goto("/app/proposals");

    await expect(range(parentPage)).toHaveText(
      `מציג 1–${PAGE_SIZE} מתוך ${SENT_COUNT}`,
      { timeout: LOAD_TIMEOUT },
    );
    await expectCardNames(parentPage, names(0, PAGE_SIZE - 1));
    await expect(
      parentPage.getByRole("link", { name: "עמוד קודם" }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  test("עמוד 2 מציג את השאר, ואפשר לחזור לעמוד 1", async () => {
    await parentPage.goto("/app/proposals");
    await expect(range(parentPage)).toBeVisible({ timeout: LOAD_TIMEOUT });

    await parentPage.getByRole("link", { name: "עמוד 2", exact: true }).click();

    await expect(parentPage).toHaveURL(/[?&]page=2/);
    await expect(range(parentPage)).toHaveText(
      `מציג ${PAGE_SIZE + 1}–${SENT_COUNT} מתוך ${SENT_COUNT}`,
      { timeout: LOAD_TIMEOUT },
    );
    await expectCardNames(parentPage, names(PAGE_SIZE, SENT_COUNT - 1));

    await parentPage.getByRole("link", { name: "עמוד קודם" }).click();
    await expect(range(parentPage)).toHaveText(
      `מציג 1–${PAGE_SIZE} מתוך ${SENT_COUNT}`,
      { timeout: LOAD_TIMEOUT },
    );
    await expect(parentPage).not.toHaveURL(/page=/);
  });

  test("עמוד שאחרי הסוף מציג את העמוד האחרון; ערך לא תקין - את הראשון", async () => {
    await parentPage.goto("/app/proposals?page=99");
    await expect(range(parentPage)).toHaveText(
      `מציג ${PAGE_SIZE + 1}–${SENT_COUNT} מתוך ${SENT_COUNT}`,
      { timeout: LOAD_TIMEOUT },
    );
    await expectCardNames(parentPage, names(PAGE_SIZE, SENT_COUNT - 1));

    for (const bad of ["0", "-3", "abc", "2.5"]) {
      await parentPage.goto(`/app/proposals?page=${bad}`);
      await expect(range(parentPage)).toHaveText(
        `מציג 1–${PAGE_SIZE} מתוך ${SENT_COUNT}`,
        { timeout: LOAD_TIMEOUT },
      );
    }
  });
});

test.describe("כל השידוכים שלי (שדכן)", () => {
  test("עמוד 1 ועמוד 2, בסדר החדשות קודם", async () => {
    await shadchanPage.goto("/app/shadchan/proposals");
    await expect(range(shadchanPage)).toHaveText(
      `מציג 1–${PAGE_SIZE} מתוך ${SENT_COUNT}`,
      { timeout: LOAD_TIMEOUT },
    );
    await expectCardNames(shadchanPage, names(0, PAGE_SIZE - 1));

    await shadchanPage
      .getByRole("link", { name: "עמוד 2", exact: true })
      .click();
    await expect(range(shadchanPage)).toHaveText(
      `מציג ${PAGE_SIZE + 1}–${SENT_COUNT} מתוך ${SENT_COUNT}`,
      { timeout: LOAD_TIMEOUT },
    );
    await expectCardNames(shadchanPage, names(PAGE_SIZE, SENT_COUNT - 1));
  });

  test("עמוד אחרי הסוף מציג את העמוד האחרון", async () => {
    await shadchanPage.goto("/app/shadchan/proposals?page=40");
    await expect(range(shadchanPage)).toHaveText(
      `מציג ${PAGE_SIZE + 1}–${SENT_COUNT} מתוך ${SENT_COUNT}`,
      { timeout: LOAD_TIMEOUT },
    );
  });
});

test.describe("הצעות שמורות (שדכן)", () => {
  const draftNames = (from: number, to: number) =>
    names(SENT_COUNT + from, SENT_COUNT + to);

  test("עמוד 1 ועמוד 2, האחרונות שנערכו קודם", async () => {
    await shadchanPage.goto("/app/shadchan/drafts");
    await expect(range(shadchanPage)).toHaveText(
      `מציג 1–${PAGE_SIZE} מתוך ${DRAFT_COUNT}`,
      { timeout: LOAD_TIMEOUT },
    );
    await expectCardNames(shadchanPage, draftNames(0, PAGE_SIZE - 1));

    await shadchanPage
      .getByRole("link", { name: "עמוד 2", exact: true })
      .click();
    await expect(range(shadchanPage)).toHaveText(
      `מציג ${PAGE_SIZE + 1}–${DRAFT_COUNT} מתוך ${DRAFT_COUNT}`,
      { timeout: LOAD_TIMEOUT },
    );
    await expectCardNames(shadchanPage, draftNames(PAGE_SIZE, DRAFT_COUNT - 1));
  });

  test("המעבר בין 'הצעות שמורות' ל'כל השידוכים' חוזר לעמוד הראשון", async () => {
    await shadchanPage.goto("/app/shadchan/drafts?page=2");
    await expect(range(shadchanPage)).toBeVisible({ timeout: LOAD_TIMEOUT });

    await shadchanPage
      .getByRole("link", { name: "כל השידוכים שלי", exact: true })
      .first()
      .click();

    await expect(shadchanPage).toHaveURL(/\/app\/shadchan\/proposals$/);
    await expect(range(shadchanPage)).toHaveText(
      `מציג 1–${PAGE_SIZE} מתוך ${SENT_COUNT}`,
      { timeout: LOAD_TIMEOUT },
    );
  });
});
