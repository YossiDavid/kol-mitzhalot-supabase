type SupabaseErrorLike = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
};

/**
 * שדות שגיאת Supabase/PostgREST כאובייקט רגיל, לרישום בלוג.
 * PostgrestError יורשת מ-Error ושדותיה אינם enumerable, ולכן
 * console.error(error) מוצג ב-overlay של Next כ-"{}" בלבד.
 */
export function describeSupabaseError(error: SupabaseErrorLike) {
  return {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  };
}
