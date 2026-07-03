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
    await admin.auth.admin.updateUserById(userId, {
      user_metadata: { phone_verified: true },
    });
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: testEmail,
      email_confirm: true,
      user_metadata: {
        role: "shadchan",
        firstName: "Test",
        lastName: "User",
        phone_verified: true,
      },
    });
    if (error) throw new Error(`Failed to create test user: ${error.message}`);
    userId = data.user.id;
  }

  // Ensure profile row exists (required by name-gate middleware)
  await admin
    .from("user_profiles")
    .upsert({ id: userId, first_name: "Test", last_name: "User" });

  // Grant shadchan role in user_roles table
  await admin
    .from("user_roles")
    .upsert({ user_id: userId, role: "shadchan" });

  // Disable phone verification gate so the test user can reach /app
  await admin
    .from("system_settings")
    .upsert({ key: "phone_verification_enabled", value: false });

  // Generate a magic link token
  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: "magiclink",
      email: testEmail,
    });
  if (linkError)
    throw new Error(`Failed to generate link: ${linkError.message}`);

  const tokenHash = linkData.properties.hashed_token;
  const type = "magiclink";

  if (!tokenHash) throw new Error("No hashed_token in generateLink response");

  // Log in via the app's /auth/confirm route
  await page.goto(
    `/auth/confirm?token_hash=${tokenHash}&type=${type}&next=/app`,
  );
  await expect(page).toHaveURL(/\/app/, { timeout: 15_000 });

  await page.context().storageState({ path: AUTH_FILE });
});
