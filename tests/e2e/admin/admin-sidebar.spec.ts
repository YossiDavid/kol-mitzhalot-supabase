import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * תפריט הניהול בסרגל הצד (בסגנון וורדפרס): בתוך /app/admin מוצגים רק פריטי
 * הניהול. האזור שמכיל את העמוד הנוכחי פתוח בתוך הסרגל, ושאר האזורים נפתחים
 * כחלונית צד במעבר עכבר או במקלדת.
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

  test("לחיצה על פריט עליון מובילה לתת-העמוד הראשון שלו", async ({ page }) => {
    // Arrange
    await gotoAdmin(page, "/app/admin");

    // Act
    await section(page, "people").click();

    // Assert
    await expect(page).toHaveURL(/\/app\/admin\/users$/);
  });

  test("הכתובת הישנה /app/admin/content מפנה לתת-העמוד הראשון", async ({
    page,
  }) => {
    // Act
    await page.goto("/app/admin/content");

    // Assert
    await expect(page).toHaveURL(/\/app\/admin\/content\/articles$/, LOAD);
  });

  test("מעבר עכבר על אזור שאינו נוכחי פותח חלונית עם הקישורים שלו", async ({
    page,
  }) => {
    // Arrange
    await gotoAdmin(page, "/app/admin");

    for (const { key, label, links } of SECTIONS) {
      // Act
      await section(page, key).hover();

      // Assert
      const panel = flyout(page, key);
      await expect(panel).toBeVisible();
      await expect(section(page, key)).toHaveAttribute("aria-expanded", "true");
      await expect(
        panel.getByRole("navigation", { name: label }),
      ).toBeVisible();
      const hrefs = await panel
        .locator("a")
        .evaluateAll((els) => els.map((el) => el.getAttribute("href")));
      expect(hrefs).toEqual(links.map(([, href]) => href));
    }
  });

  test("החלונית לא נעלמת בדרך מהפריט אליה, והלחיצה מנווטת", async ({
    page,
  }) => {
    // Arrange
    await gotoAdmin(page, "/app/admin");
    await section(page, "cards").hover();
    const target = flyout(page, "cards").getByRole("link", {
      name: "דוח הצעות",
    });
    await expect(target).toBeVisible();

    // Act - תנועה איטית בין הפריט לחלונית
    // ממתינים לסיום אנימציית הפתיחה, כדי שהמיקום יהיה סופי
    await page.waitForTimeout(ANIMATION_SETTLE_MS);
    const from = await section(page, "cards").boundingBox();
    const to = await target.boundingBox();
    if (!from || !to) throw new Error("חסרים מיקומים");
    // בדרך אופקית מהפריט אל החלונית (כמו משתמש): אחרת הסמן עובר דרך
    // הפריט הבא בסרגל ופותח את החלונית שלו
    const rowY = from.y + from.height / 2;
    await page.mouse.move(from.x + from.width / 2, rowY);
    await page.mouse.move(to.x + to.width / 2, rowY, { steps: 25 });
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
      steps: 10,
    });
    await expect(target).toBeVisible();
    await target.click();

    // Assert
    await expect(page).toHaveURL(/\/app\/admin\/proposals$/);
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
    // אזור שאינו נוכחי: לא פתוח בתוך הסרגל
    await expect(section(page, "cards")).toHaveAttribute(
      "data-active",
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

  test("מקלדת: פוקוס פותח, חץ עובר לתת-עמוד, Enter מנווט", async ({ page }) => {
    // Arrange
    await gotoAdmin(page, "/app/admin");

    // Act
    await page.keyboard.press("Tab"); // מסמן שימוש במקלדת (focus-visible)
    await section(page, "databases").focus();

    // Assert - נפתחת בפוקוס מקלדת
    await expect(flyout(page, "databases")).toBeVisible();

    // Act
    await page.keyboard.press("ArrowLeft");

    // Assert
    const first = flyout(page, "databases").getByRole("link", {
      name: "מוסדות לימוד",
    });
    await expect(first).toBeFocused();

    // Act
    await page.keyboard.press("ArrowDown");
    await expect(
      flyout(page, "databases").getByRole("link", { name: "חסידויות וקהילות" }),
    ).toBeFocused();
    await page.keyboard.press("Enter");

    // Assert
    await expect(page).toHaveURL(/\/app\/admin\/communities$/);
  });

  test("Escape סוגר את החלונית ומחזיר את הפוקוס לפריט", async ({ page }) => {
    // Arrange
    await gotoAdmin(page, "/app/admin");
    await section(page, "cards").focus();
    await page.keyboard.press("ArrowDown");
    await expect(flyout(page, "cards").getByRole("link").first()).toBeFocused();

    // Act
    await page.keyboard.press("Escape");

    // Assert
    await expect(flyout(page, "cards")).toHaveCount(0);
    await expect(section(page, "cards")).toBeFocused();
  });

  test("סרגל מכווץ: כל האזורים נפתחים כחלונית עם שם האזור", async ({
    page,
  }) => {
    // Arrange
    await gotoAdmin(page, "/app/admin/users");
    await page.locator('[data-sidebar="rail"]').click();
    await expect(
      page.locator('[data-state="collapsed"]').first(),
    ).toBeVisible();

    // Act - גם האזור הנוכחי נפתח כחלונית
    await section(page, "people").hover();

    // Assert
    const panel = flyout(page, "people");
    await expect(panel).toBeVisible();
    await expect(panel.getByText("אנשים", { exact: true })).toBeVisible();
    await panel.getByRole("link", { name: "כל השדכנים" }).click();
    await expect(page).toHaveURL(/\/app\/admin\/shadchanim$/);
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
