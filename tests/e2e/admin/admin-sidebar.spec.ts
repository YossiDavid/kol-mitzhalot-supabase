import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * תפריט הניהול בסרגל הצד: בתוך /app/admin מוצגים רק פריטי הניהול. בסרגל
 * מורחב כל אזור הוא אקורדיון בתוך הסרגל (לחיצה פותחת וסוגרת, לא מנווטת,
 * ושום דבר לא נפתח במעבר עכבר); האזור הנוכחי פתוח כברירת מחדל. בסרגל
 * מכווץ מעבר עכבר מציג tooltip בלבד, ולחיצה פותחת חלונית עם הקישורים.
 */
const DESKTOP = { width: 1440, height: 900 };
const LOAD = { timeout: 15_000 };
const ANIMATION_SETTLE_MS = 400;

type SectionSpec = {
  key: string;
  label: string;
  links: ReadonlyArray<readonly [string, string]>;
};

const SECTIONS: readonly SectionSpec[] = [
  {
    key: "people",
    label: "אנשים",
    links: [
      ["כל המשתמשים", "/app/admin/users"],
      ["כל השדכנים", "/app/admin/shadchanim"],
      ["בקשות הצטרפות כשדכן", "/app/admin/shadchanim/requests"],
      ["בקשות הצטרפות כאיש צוות", "/app/admin/staff/requests"],
    ],
  },
  {
    key: "cards",
    label: "כרטיסים והצעות",
    links: [
      ["כרטיסי צד שלישי", "/app/admin/third-party-cards"],
      ["בקשות צפייה בתמונה", "/app/admin/photo-requests"],
      ["דוח הצעות", "/app/admin/proposals"],
      ["שיוך מוסד המוני", "/app/admin/students/institutions"],
    ],
  },
  {
    key: "content",
    label: "תוכן האתר",
    links: [
      ["מאמרים", "/app/admin/content/articles"],
      ["מודעות מאורסים", "/app/admin/content/engagements"],
      ["המלצות רבנים", "/app/admin/content/endorsements"],
      ["רשימת תפוצה", "/app/admin/content/newsletter"],
      ["פניות מהאתר", "/app/admin/content/submissions"],
    ],
  },
  {
    key: "databases",
    label: "מאגרים",
    links: [
      ["מוסדות לימוד", "/app/admin/institutions"],
      ["חסידויות וקהילות", "/app/admin/communities"],
    ],
  },
  {
    key: "finance",
    label: "כספים והגדרות",
    links: [
      ["תרומות", "/app/admin/donations"],
      ["הגדרות מערכת", "/app/admin/settings"],
    ],
  },
];

const nav = (page: Page): Locator => page.getByTestId("admin-sidebar-nav");
const section = (page: Page, key: string): Locator =>
  page.getByTestId(`admin-nav-section-${key}`);
const flyout = (page: Page, key: string): Locator =>
  page.getByTestId(`admin-flyout-${key}`);
/** תתי העמודים של אזור בתוך הסרגל (האקורדיון) */
const inlineLinks = (page: Page, label: string): Locator =>
  nav(page).getByRole("list", { name: label });

/** הסרגל מתחיל מכווץ בלי העוגייה sidebar_state=true */
async function gotoAdmin(page: Page, path: string, isExpanded = true) {
  await page.setViewportSize(DESKTOP);
  if (isExpanded) {
    await page.context().addCookies([
      {
        name: "sidebar_state",
        value: "true",
        domain: "localhost",
        path: "/",
      },
    ]);
  }
  await page.goto(path);
  await expect(nav(page)).toBeVisible(LOAD);
}

test.describe("סרגל צד — תפריט ניהול", () => {
  test("בלוח הבקרה: רק פריטי הניהול, בלי הניווט הרגיל", async ({ page }) => {
    // Act
    await gotoAdmin(page, "/app/admin");

    // Assert
    await expect(page.getByTestId("admin-sidebar-back")).toHaveAttribute(
      "href",
      "/app",
    );
    await expect(page.getByTestId("admin-sidebar-home")).toHaveAttribute(
      "href",
      "/app/admin",
    );
    await expect(page.getByTestId("admin-sidebar-home")).toHaveText(
      "לוח הבקרה",
    );
    for (const { key, label } of SECTIONS) {
      await expect(section(page, key)).toHaveText(label);
    }
    const sidebar = page.locator('[data-sidebar="content"]');
    for (const name of [
      "לוח העבודה",
      "כלי שדכן",
      "מידע ותוכן",
      "פורום שדכנים",
    ]) {
      await expect(sidebar.getByText(name, { exact: true })).toHaveCount(0);
    }
    // הפוטר נשאר: קישור לאתר והתנתקות
    await expect(page.getByTestId("sidebar-site-link")).toBeVisible();
    await expect(
      page.locator('[data-sidebar="footer"]').getByText("התנתקות"),
    ).toBeVisible();
  });

  test("לחיצה על כותרת אזור פותחת וסוגרת בתוך הסרגל ולא מנווטת", async ({
    page,
  }) => {
    // Arrange
    await gotoAdmin(page, "/app/admin");
    const header = section(page, "people");
    await expect(header).toHaveAttribute("aria-expanded", "false");

    // Act
    await header.click();

    // Assert
    await expect(header).toHaveAttribute("aria-expanded", "true");
    await expect(header).toHaveAttribute("aria-controls", /.+/);
    await expect(page).toHaveURL(/\/app\/admin$/);
    await expect(inlineLinks(page, "אנשים").getByRole("link")).toHaveCount(4);

    // Act
    await header.click();

    // Assert
    await expect(header).toHaveAttribute("aria-expanded", "false");
    await expect(inlineLinks(page, "אנשים")).toHaveCount(0);
    await expect(page).toHaveURL(/\/app\/admin$/);
  });

  test("מעבר עכבר ופוקוס לא פותחים כלום", async ({ page }) => {
    // Arrange
    await gotoAdmin(page, "/app/admin");

    for (const { key } of SECTIONS) {
      // Act
      await section(page, key).hover();
      await page.waitForTimeout(ANIMATION_SETTLE_MS);

      // Assert
      await expect(section(page, key)).toHaveAttribute(
        "aria-expanded",
        "false",
      );
      await expect(flyout(page, key)).toHaveCount(0);
    }

    // Act - פוקוס מקלדת
    await page.keyboard.press("Tab");
    await section(page, "databases").focus();
    await page.waitForTimeout(ANIMATION_SETTLE_MS);

    // Assert
    await expect(section(page, "databases")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await expect(nav(page).locator('[data-sidebar="menu-sub"]')).toHaveCount(0);
  });

  test("כמה אזורים יכולים להיות פתוחים יחד", async ({ page }) => {
    // Arrange
    await gotoAdmin(page, "/app/admin");

    // Act
    await section(page, "people").click();
    await section(page, "cards").click();

    // Assert
    await expect(section(page, "people")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await expect(section(page, "cards")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    const hrefs = await nav(page)
      .locator('[data-sidebar="menu-sub"] a')
      .evaluateAll((els) => els.map((el) => el.getAttribute("href")));
    expect(hrefs).toEqual([
      ...SECTIONS[0].links.map(([, href]) => href),
      ...SECTIONS[1].links.map(([, href]) => href),
    ]);
  });

  test("ניווט לתת-עמוד משאיר את האזור פתוח", async ({ page }) => {
    // Arrange
    await gotoAdmin(page, "/app/admin");
    await section(page, "finance").click();

    // Act
    await nav(page).getByRole("link", { name: "תרומות" }).click();

    // Assert
    // הניווט הראשון לדף מקמפל אותו בשרת הפיתוח - תחת עומס זה עובר את 5 השניות
    await expect(page).toHaveURL(/\/app\/admin\/donations$/, LOAD);
    await expect(section(page, "finance")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await expect(nav(page).locator('a[aria-current="page"]')).toHaveText(
      "תרומות",
    );
  });

  test("הכתובת הישנה /app/admin/content מפנה לתת-העמוד הראשון", async ({
    page,
  }) => {
    // Act
    await page.goto("/app/admin/content");

    // Assert
    await expect(page).toHaveURL(/\/app\/admin\/content\/articles$/, LOAD);
  });

  test("האזור הנוכחי פתוח בתוך הסרגל, ותת-העמוד מודגש", async ({ page }) => {
    // Act
    // תת-עמוד שקיים באמת: מזהה משתמש בדוי מחזיר 404, שמחליף את כל המסך
    // כולל הסרגל
    await gotoAdmin(page, "/app/admin/users/create");

    // Assert
    const sub = nav(page).locator('[data-sidebar="menu-sub"]');
    await expect(sub).toHaveCount(1);
    await expect(sub.getByRole("link")).toHaveCount(4);
    await expect(sub.locator('a[aria-current="page"]')).toHaveText(
      "כל המשתמשים",
    );
    await expect(section(page, "people")).toHaveAttribute(
      "data-active",
      "true",
    );
    await expect(section(page, "people")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    // אזור שאינו נוכחי: סגור
    await expect(section(page, "cards")).toHaveAttribute(
      "data-active",
      "false",
    );
    await expect(section(page, "cards")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  test("התאמה הארוכה ביותר: בקשות שדכן מדליקות רק את הבקשות", async ({
    page,
  }) => {
    // Act
    await gotoAdmin(page, "/app/admin/shadchanim/requests");

    // Assert
    const active = nav(page).locator('a[aria-current="page"]');
    await expect(active).toHaveCount(1);
    await expect(active).toHaveText("בקשות הצטרפות כשדכן");
  });

  test("תת-עמוד של הגדרות מדליק את 'הגדרות מערכת'", async ({ page }) => {
    // Act
    await gotoAdmin(page, "/app/admin/settings/privacy-policy");

    // Assert
    await expect(nav(page).locator('a[aria-current="page"]')).toHaveText(
      "הגדרות מערכת",
    );
    await expect(section(page, "finance")).toHaveAttribute(
      "data-active",
      "true",
    );
  });

  test("לוח הבקרה פעיל רק בכתובת המדויקת", async ({ page }) => {
    // Act + Assert
    await gotoAdmin(page, "/app/admin");
    await expect(page.getByTestId("admin-sidebar-home")).toHaveAttribute(
      "data-active",
      "true",
    );

    await gotoAdmin(page, "/app/admin/donations");
    await expect(page.getByTestId("admin-sidebar-home")).toHaveAttribute(
      "data-active",
      "false",
    );
  });

  test("מקלדת: Enter ורווח פותחים וסוגרים, Tab ממשיך לתתי העמודים", async ({
    page,
  }) => {
    // Arrange
    await gotoAdmin(page, "/app/admin");
    await section(page, "databases").focus();

    // Act + Assert - Enter פותח, Tab עובר לתתי העמודים
    await page.keyboard.press("Enter");
    await expect(section(page, "databases")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await page.keyboard.press("Tab");
    await expect(
      nav(page).getByRole("link", { name: "מוסדות לימוד" }),
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      nav(page).getByRole("link", { name: "חסידויות וקהילות" }),
    ).toBeFocused();

    // Act + Assert - רווח סוגר
    await section(page, "databases").focus();
    await page.keyboard.press("Space");
    await expect(section(page, "databases")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  test("סרגל מכווץ: מעבר עכבר מציג tooltip בלבד, ולחיצה פותחת חלונית", async ({
    page,
  }) => {
    // Arrange
    await gotoAdmin(page, "/app/admin/users");
    await page.locator('[data-sidebar="rail"]').click();
    await expect(
      page.locator('[data-state="collapsed"]').first(),
    ).toBeVisible();

    // Act - מעבר עכבר
    await section(page, "people").hover();

    // Assert - tooltip עם שם האזור, בלי חלונית
    await expect(page.getByRole("tooltip")).toHaveText("אנשים");
    await expect(flyout(page, "people")).toHaveCount(0);

    // Act - לחיצה
    await section(page, "people").click();

    // Assert
    const panel = flyout(page, "people");
    await expect(panel).toBeVisible();
    await expect(panel.getByText("אנשים", { exact: true })).toBeVisible();
    await expect(panel.locator("a")).toHaveCount(4);

    // Act - Escape סוגר
    await page.keyboard.press("Escape");
    await expect(flyout(page, "people")).toHaveCount(0);

    // Act - פתיחה מחדש ובחירת קישור
    await section(page, "people").click();
    await flyout(page, "people")
      .getByRole("link", { name: "כל השדכנים" })
      .click();

    // Assert
    await expect(page).toHaveURL(/\/app\/admin\/shadchanim$/);
    await expect(flyout(page, "people")).toHaveCount(0);
  });

  test("חזרה למערכת מחזירה לניווט הרגיל", async ({ page }) => {
    // Arrange
    await gotoAdmin(page, "/app/admin/donations");

    // Act
    await page.getByTestId("admin-sidebar-back").click();

    // Assert
    await expect(page).toHaveURL(/\/app$/);
    const sidebar = page.locator('[data-sidebar="content"]');
    await expect(sidebar.getByText("כלי שדכן", { exact: true })).toBeVisible(
      LOAD,
    );
    await expect(page.getByTestId("admin-sidebar-nav")).toHaveCount(0);
  });

  test("כל יעד בתפריט נטען בלי שגיאה ועם כותרת", async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize(DESKTOP);

    for (const { links } of SECTIONS) {
      for (const [, href] of links) {
        // Act
        await page.goto(href);

        // Assert
        await expect(page.locator("h1").first()).toBeVisible(LOAD);
        await expect(nav(page)).toBeVisible();
      }
    }
  });

  test("מובייל: כל דפי הניהול נגישים מהתפריט שנפתח מההדר", async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("/app/admin");
    const trigger = page.getByTestId("admin-mobile-menu-trigger");
    await expect(trigger).toBeVisible(LOAD);

    for (const { key, label, links } of SECTIONS) {
      for (const [title, href] of links) {
        // Act
        await trigger.click();
        const header = page.getByTestId(`admin-nav-section-${key}`);
        await expect(header).toBeVisible();
        if ((await header.getAttribute("aria-expanded")) !== "true") {
          await header.click();
        }
        await page
          .getByRole("dialog")
          .getByRole("link", { name: title, exact: true })
          .click();

        // Assert
        await expect(page).toHaveURL(new RegExp(`${href}$`), LOAD);
        await expect(page.locator("h1").first()).toBeVisible(LOAD);
        await expect(page.getByRole("dialog")).toHaveCount(0);
        expect(label).toBeTruthy();
      }
    }
  });

  test("מובייל: אין תפריט ניהול כשלא בתוך אזור הניהול", async ({ page }) => {
    // Act
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("/app");

    // Assert
    await expect(page.getByTestId("admin-mobile-menu-trigger")).toHaveCount(0);
  });
});
