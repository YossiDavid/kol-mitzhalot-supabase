import { createClient } from "@/lib/supabase/server";

export type { Role, UserWithRole } from "./user-role";
export { getEffectiveRole, getRoleLabel } from "./user-role";

export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getUserMetadata() {
  const user = await getUser();
  return user?.user_metadata;
}
