// צילומי מסך של המסכים המרכזיים, להשוואת לפני/אחרי ב-refactor העיצובי
// (docs/design-refactor/PLAN.md). לסביבה המקומית בלבד.
//
//   pnpm capture:ui before    →  .ui-captures/before/<page>-<viewport>.png
//   pnpm capture:ui after
//
// דורש שרת פיתוח פעיל ו-Supabase מקומי, ומצב התחברות של בדיקות ה-e2e
// (playwright/.auth/*.json - נוצר ב-pnpm test:e2e).

import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const OUT_ROOT = ".ui-captures";
const USER_STATE = "playwright/.auth/user.json";
const ADMIN_STATE = "playwright/.auth/admin.json";
/** זמן התייצבות אחרי טעינה - אנימציות, גופנים ותמונות */
const SETTLE_MS = 800;
const NAVIGATION_TIMEOUT_MS = 30_000;

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

async function findStudentId() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  assertLocalSupabase(url);
  const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase
    .from("students")
    .select("id")
    .is("deleted_at", null)
    .eq("gender", "male")
    .order("photo_count", { ascending: false })
    .limit(1);
  if (error) throw new Error(`שליפת כרטיס לדוגמה נכשלה: ${error.message}`);
  return data?.[0]?.id ?? null;
}

function buildPages(studentId) {
  return [
    { name: "dashboard", path: "/app", state: USER_STATE },
    { name: "students-list", path: "/app/students", state: USER_STATE },
    ...(studentId
      ? [{ name: "student-card", path: `/app/students/${studentId}`, state: USER_STATE }]
      : []),
    { name: "form-intro", path: "/app/students/create", state: USER_STATE },
    { name: "form-personal", path: "/app/students/create", state: USER_STATE, step: "פרטים אישיים" },
    { name: "form-family", path: "/app/students/create", state: USER_STATE, step: "על המשפחה" },
    { name: "shadchan-proposals", path: "/app/shadchan/proposals", state: USER_STATE },
    { name: "settings", path: "/app/settings", state: USER_STATE },
    { name: "admin-users", path: "/app/admin/users", state: ADMIN_STATE },
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
    await page.waitForTimeout(SETTLE_MS);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`✓ ${file}`);
  } catch (error) {
    // מצלמים גם מצב שנכשל, כדי שההשוואה לא תחסר מסך בשקט
    await page.screenshot({ path: file, fullPage: true }).catch(() => {});
    console.warn(`⚠ ${pageSpec.name}-${viewportName}: ${error.message.split("\n")[0]}`);
  } finally {
    await context.close();
  }
}

async function main() {
  const label = process.argv[2];
  if (!label || !/^[a-z0-9-]+$/.test(label)) {
    throw new Error("שימוש: pnpm capture:ui <label>  (אותיות לטיניות קטנות, ספרות ומקף)");
  }

  const outDir = `${OUT_ROOT}/${label}`;
  await mkdir(outDir, { recursive: true });

  const pages = buildPages(await findStudentId());
  const browser = await chromium.launch();
  try {
    for (const pageSpec of pages) {
      for (const viewportName of Object.keys(VIEWPORTS)) {
        await capturePage(browser, pageSpec, viewportName, outDir);
      }
    }
  } finally {
    await browser.close();
  }
  console.log(`\nנשמרו ב-${outDir}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
