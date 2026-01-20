import { createClient } from "@supabase/supabase-js";

/**
 * Creates a Supabase Admin Client with service role key
 * This client has admin privileges and can update protected fields like phone_confirmed_at
 * WARNING: Only use this on the server side, never expose the service role key to the client
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseServiceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Please add it to your environment variables.\n" +
      "You can find it in your Supabase project settings: https://supabase.com/dashboard/project/_/settings/api\n" +
      "Add it to your .env.local file as: SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here",
    );
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
