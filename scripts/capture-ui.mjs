// צילומי מסך של המסכים המרכזיים, להשוואת לפני/אחרי ב-refactor העיצובי
// (docs/design-refactor/PLAN.md). לסביבה המקומית בלבד.
//
//   pnpm capture:ui before    →  .ui-captures/before/<page>-<viewport>.png
//   pnpm capture:ui after
//
// דורש שרת פיתוח פעיל ו-Supabase מקומי, ומצב התחברות של בדיקות ה-e2e
// (playwright/.auth/*.json - נוצר ב-pnpm test:e2e). משתמשי הזרע (הורה ושדכן
// הזרע) מתחברים כאן בקישור קסם, והמצב נשמר ב-.ui-captures/.auth.
//
// לצד הצילומים נכתב h1-counts.json: מספר כותרות h1 בכל עמוד ורוחב.

import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const OUT_ROOT = ".ui-captures";
const SESSION_DIR = `${OUT_ROOT}/.auth`;
const USER_STATE = "playwright/.auth/user.json"; // שדכן
const ADMIN_STATE = "playwright/.auth/admin.json";
const PARENT_STATE = `${SESSION_DIR}/parent.json`;
const SEED_SHADCHAN_STATE = `${SESSION_DIR}/seed-shadchan.json`;
/** משתמשי הזרע מ-supabase/seed.sql */
const PARENT_EMAIL = "parent-groom@local.test";
const SEED_SHADCHAN_EMAIL = "shadchan@local.test";
const SEED_SHADCHAN_ID = "22222222-2222-2222-2222-222222222222";
const PARENT_ID = "33333333-3333-3333-3333-333333333333";
/** זמן התייצבות אחרי טעינה - אנימציות, גופנים ותמונות */
const SETTLE_MS = 800;
const NAVIGATION_TIMEOUT_MS = 30_000;
const LOGIN_TIMEOUT_MS = 20_000;

const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 1024, height: 900 },
  desktop: { width: 1440, height: 900 },
};

function assertLocalSupabase(url) {
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(url ?? "")) {
    throw new Error(`רק מול Supabase מקומי. הכתובת היא: ${url || "(ריקה)"}`);
  }
}

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  assertLocalSupabase(url);
  return createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function findStudentId(supabase, gender) {
  const { data, error } = await supabase
    .from("students")
    .select("id")
    .is("deleted_at", null)
    .eq("gender", gender)
    .order("photo_count", { ascending: false })
    .limit(1);
  if (error) throw new Error(`שליפת כרטיס לדוגמה נכשלה: ${error.message}`);
  return data?.[0]?.id ?? null;
}

/** התחברות בקישור קסם דרך /auth/confirm, כמו ב-tests/e2e/auth.setup.ts */
async function createSessionState(browser, supabase, email, file) {
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) {
    console.warn(`⚠ התחברות ${email} נכשלה: ${error?.message ?? "אין טוקן"}`);
    return null;
  }
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(
      `${BASE_URL}/auth/confirm?token_hash=${tokenHash}&type=magiclink&next=/app`,
    );
    await page.waitForURL(/\/app/, { timeout: LOGIN_TIMEOUT_MS });
    await context.storageState({ path: file });
    return file;
  } catch (loginError) {
    console.warn(`⚠ התחברות ${email} נכשלה: ${loginError.message.split("\n")[0]}`);
    return null;
  } finally {
    await context.close();
  }
}

const ADMIN_PATHS = [
  ["admin", "/app/admin"],
  ["admin-users", "/app/admin/users"],
  ["admin-shadchanim", "/app/admin/shadchanim"],
  ["admin-shadchanim-requests", "/app/admin/shadchanim/requests"],
  ["admin-staff-requests", "/app/admin/staff/requests"],
  ["admin-institutions", "/app/admin/institutions"],
  ["admin-students-institutions", "/app/admin/students/institutions"],
  ["admin-photo-requests", "/app/admin/photo-requests"],
  ["admin-content", "/app/admin/content"],
  ["admin-content-articles", "/app/admin/content/articles"],
  ["admin-content-engagements", "/app/admin/content/engagements"],
  ["admin-content-endorsements", "/app/admin/content/endorsements"],
  ["admin-content-submissions", "/app/admin/content/submissions"],
  ["admin-content-newsletter", "/app/admin/content/newsletter"],
  ["admin-settings", "/app/admin/settings"],
];

function buildPages({ maleStudentId, femaleStudentId, parentState, seedShadchanState }) {
  return [
    { name: "dashboard", path: "/app", state: USER_STATE },
    ...(parentState
      ? [
          { name: "dashboard-parent", path: "/app", state: parentState },
          { name: "proposals", path: "/app/proposals", state: parentState },
          {
            name: "shadchan-profile-dialog",
            path: `/app/shadchanim/${SEED_SHADCHAN_ID}`,
            state: parentState,
            click: { role: "button", name: "פניה לשדכן" },
          },
        ]
      : []),
    { name: "students-list", path: "/app/students", state: USER_STATE },
    ...(maleStudentId
      ? [{ name: "student-card", path: `/app/students/${maleStudentId}`, state: USER_STATE }]
      : []),
    ...(femaleStudentId
      ? [
          {
            name: "photo-request-dialog",
            path: `/app/students/${femaleStudentId}`,
            state: USER_STATE,
            click: { role: "button", name: "בקשת הרשאה לצפייה בתמונה" },
          },
        ]
      : []),
    { name: "form-intro", path: "/app/students/create", state: USER_STATE },
    { name: "form-personal", path: "/app/students/create", state: USER_STATE, step: "פרטים אישיים" },
    { name: "form-family", path: "/app/students/create", state: USER_STATE, step: "על המשפחה" },
    { name: "shadchan-proposals", path: "/app/shadchan/proposals", state: USER_STATE },
    { name: "shadchan-drafts", path: "/app/shadchan/drafts", state: USER_STATE },
    { name: "settings", path: "/app/settings", state: USER_STATE },
    { name: "settings-shadchan", path: "/app/settings/shadchan", state: USER_STATE },
    { name: "settings-staff", path: "/app/settings/staff", state: USER_STATE },
    { name: "shadchanim", path: "/app/shadchanim", state: USER_STATE },
    { name: "chats", path: "/app/chats", state: USER_STATE },
    { name: "canvas", path: "/app/canvas", state: USER_STATE },
    { name: "forums", path: "/app/forums", state: USER_STATE },
    {
      name: "forums-dialog",
      path: "/app/forums",
      state: USER_STATE,
      click: { role: "button", name: "פוסט חדש" },
    },
    ...ADMIN_PATHS.map(([name, path]) => ({ name, path, state: ADMIN_STATE })),
    { name: "admin-user-details", path: `/app/admin/users/${PARENT_ID}`, state: ADMIN_STATE },
    { name: "login", path: "/auth/login", state: null },
    { name: "design-system", path: "/dev/design-system", state: null },
  ];
}

/** בוחר "מיועד" ועובר לשלב המבוקש בטופס. לא ממלא ולא שולח דבר. */
async function openFormStep(page, step) {
  await page.getByRole("radio", { name: "מיועד", exact: true }).check();
  await page.getByRole("button", { name: step, exact: true }).first().click();
  await page.getByRole("heading", { name: step }).first().waitFor();
}

/** פותח דיאלוג בלבד - לא שולח ולא מאשר דבר */
async function openDialog(page, click) {
  await page.getByRole(click.role, { name: click.name }).first().click();
  await page.getByRole("dialog").first().waitFor();
}

async function countHeadings(page) {
  return page.evaluate(() => {
    const all = Array.from(document.querySelectorAll("main h1, [role=dialog] h1"));
    const visible = all.filter((el) => {
      const box = el.getBoundingClientRect();
      return box.width > 0 && box.height > 0;
    });
    return {
      h1: all.length,
      visibleH1: visible.length,
      texts: visible.map((el) => el.textContent?.trim().slice(0, 40)),
    };
  });
}

async function capturePage(browser, pageSpec, viewportName, outDir) {
  const context = await browser.newContext({
    viewport: VIEWPORTS[viewportName],
    locale: "he-IL",
    ...(pageSpec.state ? { storageState: pageSpec.state } : {}),
  });
  const page = await context.newPage();
  const file = `${outDir}/${pageSpec.name}-${viewportName}.png`;
  try {
    await page.goto(`${BASE_URL}${pageSpec.path}`, {
      waitUntil: "networkidle",
      timeout: NAVIGATION_TIMEOUT_MS,
    });
    if (pageSpec.step) await openFormStep(page, pageSpec.step);
    if (pageSpec.click) await openDialog(page, pageSpec.click);
    await page.waitForTimeout(SETTLE_MS);
    const headings = pageSpec.click ? null : await countHeadings(page);
    await page.screenshot({ path: file, fullPage: !pageSpec.click });
    console.log(`✓ ${file}`);
    return headings;
  } catch (error) {
    // מצלמים גם מצב שנכשל, כדי שההשוואה לא תחסר מסך בשקט
    await page.screenshot({ path: file, fullPage: true }).catch(() => {});
    console.warn(`⚠ ${pageSpec.name}-${viewportName}: ${error.message.split("\n")[0]}`);
    return { error: error.message.split("\n")[0] };
  } finally {
    await context.close();
  }
}

function summarizeHeadings(results) {
  const pages = Object.entries(results).filter(([, value]) => value && !value.error);
  const exactlyOne = pages.filter(([, value]) => value.visibleH1 === 1).length;
  return { captures: pages.length, withExactlyOneVisibleH1: exactlyOne };
}

async function main() {
  const label = process.argv[2];
  if (!label || !/^[a-z0-9-]+$/.test(label)) {
    throw new Error("שימוש: pnpm capture:ui <label>  (אותיות לטיניות קטנות, ספרות ומקף)");
  }

  const outDir = `${OUT_ROOT}/${label}`;
  await mkdir(outDir, { recursive: true });
  await mkdir(SESSION_DIR, { recursive: true });

  const supabase = createServiceClient();
  const browser = await chromium.launch();
  const results = {};
  try {
    const pages = buildPages({
      maleStudentId: await findStudentId(supabase, "male"),
      femaleStudentId: await findStudentId(supabase, "female"),
      parentState: await createSessionState(browser, supabase, PARENT_EMAIL, PARENT_STATE),
      seedShadchanState: await createSessionState(
        browser,
        supabase,
        SEED_SHADCHAN_EMAIL,
        SEED_SHADCHAN_STATE,
      ),
    });
    for (const pageSpec of pages) {
      for (const viewportName of Object.keys(VIEWPORTS)) {
        const headings = await capturePage(browser, pageSpec, viewportName, outDir);
        if (headings) results[`${pageSpec.name}-${viewportName}`] = headings;
      }
    }
  } finally {
    await browser.close();
  }
  const report = { summary: summarizeHeadings(results), pages: results };
  await writeFile(`${outDir}/h1-counts.json`, JSON.stringify(report, null, 2));
  console.log(`\nh1: ${JSON.stringify(report.summary)}`);
  console.log(`נשמרו ב-${outDir}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
