import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

export type { Role, UserWithRole } from "./user-role";
export {
  getEffectiveRole,
  getRoleLabel,
  getRoles,
  hasRole,
  primaryRole,
  pickHighestPrecedenceRole,
} from "./user-role";

/**
 * ממוזכר לכל בקשה: מעטפת /app קוראת אותו מכמה אזורים שמשודרים בנפרד,
 * ובלי cache כל אחד מהם היה פונה מחדש לשרת האימות.
 */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export async function getUserMetadata() {
  const user = await getUser();
  return user?.user_metadata;
}
