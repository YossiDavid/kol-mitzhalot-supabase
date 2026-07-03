import { test as setup, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const AUTH_FILE = "playwright/.auth/user.json";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const testEmail =
  process.env.TEST_USER_EMAIL ?? "playwright-test@kol-mitzhalot.test";

setup("authenticate test user", async ({ page }) => {
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Create test user if needed
  const { data: existingUsers } = await admin.auth.admin.listUsers();
  const existing = existingUsers?.users.find((u) => u.email === testEmail);

  let userId: string;
  if (existing) {
    userId = existing.id;
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: testEmail,
      email_confirm: true,
      user_metadata: {
        role: "shadchan",
        firstName: "Test",
        lastName: "User",
      },
    });
    if (error) throw new Error(`Failed to create test user: ${error.message}`);
    userId = data.user.id;
  }

  // Ensure profile row exists (required by name-gate middleware)
  await admin
    .from("user_profiles")
    .upsert({ id: userId, first_name: "Test", last_name: "User" });

  // Generate a magic link token
  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: "magiclink",
      email: testEmail,
    });
  if (linkError)
    throw new Error(`Failed to generate link: ${linkError.message}`);

  const linkUrl = new URL(linkData.properties.action_link);
  const tokenHash = linkUrl.searchParams.get("token_hash");
  const type = linkUrl.searchParams.get("type") ?? "magiclink";

  if (!tokenHash) throw new Error("No token_hash in magic link");

  // Log in via the app's /auth/confirm route
  await page.goto(
    `/auth/confirm?token_hash=${tokenHash}&type=${type}&next=/app`,
  );
  await expect(page).toHaveURL(/\/app/, { timeout: 15_000 });

  await page.context().storageState({ path: AUTH_FILE });
});
