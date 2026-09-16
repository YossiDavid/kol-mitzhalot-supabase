import { defineConfig, devices } from "@playwright/test";

import { assertLocalSupabase, loadEnvFile } from "./tests/load-env";

// auth.setup.ts והעוזרים של הבדיקות זקוקים ל-NEXT_PUBLIC_SUPABASE_URL
// ול-SUPABASE_SERVICE_ROLE_KEY, ו-Playwright אינו קורא בעצמו את קובצי ה-.env
// של הפרויקט כפי ש-next dev עושה.
loadEnvFile();

// הבדיקות כותבות נתונים אמיתיים ואינן מנקות הכול, ולכן ריצה מול מסד שאינו
// מקומי נחסמת כאן — לפני שנוצרה ולו רשומה אחת.
assertLocalSupabase();

// הבדיקות רצות מול השרת שבכתובת הזו, ואותו פורט מועבר גם ל-webServer: בלעדיו
// Playwright היה מרים (או "מוצא") שרת על 3000 בזמן שהבדיקות פונות לפורט אחר.
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const DEV_PORT = new URL(BASE_URL).port || "3000";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    video: "on-first-retry",
    locale: "he-IL",
  },

  projects: [
    {
      name: "setup",
      testMatch: "**/auth.setup.ts",
    },
    {
      name: "setup-admin",
      testMatch: "**/auth.setup.admin.ts",
    },
    // User: "9. אתה יכול להוסיף גם טסטים." — marketing project needs no auth.
    {
      name: "marketing",
      use: {
        ...devices["Desktop Chrome"],
      },
      testMatch: "**/marketing/**/*.spec.ts",
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      dependencies: ["setup"],
      testIgnore: ["**/admin/**/*.spec.ts", "**/marketing/**/*.spec.ts"],
    },
    {
      name: "chromium-admin",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/admin.json",
      },
      dependencies: ["setup-admin"],
      testMatch: "**/admin/**/*.spec.ts",
    },
  ],

  webServer: {
    command: `pnpm dev --port ${DEV_PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
