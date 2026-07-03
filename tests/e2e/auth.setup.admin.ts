import { test as setup, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

export const ADMIN_AUTH_FILE = "playwright/.auth/admin.json";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const adminEmail =
  process.env.TEST_ADMIN_EMAIL ?? "playwright-admin@kol-mitzhalot.test";

setup("authenticate admin test user", async ({ page }) => {
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: existingUsers } = await admin.auth.admin.listUsers();
  const existing = existingUsers?.users.find((u) => u.email === adminEmail);

  let userId: string;
  if (existing) {
    userId = existing.id;
    await admin.auth.admin.updateUserById(userId, {
      user_metadata: { role: "admin", phone_verified: true, firstName: "Admin", lastName: "Test" },
    });
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: adminEmail,
      email_confirm: true,
      user_metadata: {
        role: "admin",
        firstName: "Admin",
        lastName: "Test",
        phone_verified: true,
      },
    });
    if (error) throw new Error(`Failed to create admin user: ${error.message}`);
    userId = data.user.id;
  }

  // Ensure profile row exists
  await admin
    .from("user_profiles")
    .upsert({ id: userId, first_name: "Admin", last_name: "Test" });

  // Grant admin role in user_roles table
  await admin
    .from("user_roles")
    .upsert({ user_id: userId, role: "admin" });

  // Generate magic link
  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: "magiclink",
      email: adminEmail,
    });
  if (linkError)
    throw new Error(`Failed to generate admin link: ${linkError.message}`);

  const tokenHash = linkData.properties.hashed_token;
  if (!tokenHash) throw new Error("No hashed_token in generateLink response");

  await page.goto(
    `/auth/confirm?token_hash=${tokenHash}&type=magiclink&next=/app`,
  );
  await expect(page).toHaveURL(/\/app/, { timeout: 15_000 });

  await page.context().storageState({ path: ADMIN_AUTH_FILE });
});
