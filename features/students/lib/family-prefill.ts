import type { SupabaseClient } from "@supabase/supabase-js";

import type { StudentFormValues } from "@/features/students/components/create-form/schema";
import {
  studentToFormValues,
  type StudentRowWithRelations,
} from "@/features/students/lib/student-to-form";

/** פרטי המשפחה שמועתקים לכרטיס חדש של אח/אחות (הורים, משפחה, מצב ההורים) */
export type FamilyPrefillValues = Pick<
  StudentFormValues,
  "father" | "mother" | "family" | "parents"
>;

export type FamilyPrefill = {
  /** שם המיועד/ת בכרטיס המקור, לכפתור "מילוי מהכרטיס של..." */
  sourceName: string;
  values: FamilyPrefillValues;
};

/**
 * הכרטיס האחרון שהמשתמש מילא עבור ילד/ה (card_for=child) - כדי שהורה שממלא
 * כרטיס לילד נוסף לא יזין שוב את פרטי המשפחה. "מקומו במשפחה" אינו מועתק.
 * null כשאין כרטיס כזה או שהשליפה נכשלה (נרשם).
 */
export async function loadFamilyPrefill(
  supabase: SupabaseClient,
  userId: string,
): Promise<FamilyPrefill | null> {
  const { data, error } = await supabase
    .from("students")
    .select("first_name, last_name, card_for, parents_info, family_info")
    .eq("user_id", userId)
    .eq("card_for", "child")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[students/family-prefill] load failed", error.message);
    return null;
  }
  if (!data?.parents_info) return null;

  const form = studentToFormValues(data as unknown as StudentRowWithRelations);
  return {
    sourceName: `${data.first_name} ${data.last_name}`.trim(),
    values: {
      father: form.father,
      mother: form.mother,
      family: { ...form.family, currentChildPlace: "" },
      parents: form.parents,
    },
  };
}
