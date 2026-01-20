import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    // שים לב: במימוש Server אפשר (ורצוי) להשתמש ב-SUPABASE_ANON_KEY מהשרת
    // ולא לחשוף אותו בקוד לקליינט. אבל אנונימי הוא לא "סודי".
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}
