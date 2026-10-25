import { createAdminClient } from "@/lib/supabase/admin";

/** אח/אחות במערכת: כרטיס נוסף של אותו הורה (אותה משפחה גרעינית) */
export type CardSibling = {
  id: string;
  name: string;
  gender: string | null;
  /** מבוגר/ת או צעיר/ה מבעל הכרטיס; null כשאין תאריכי לידה */
  relativeAge: "older" | "younger" | null;
  /** בשידוכים כרגע (לא מאורס/נשוי ולא הוצא) */
  isInShidduchim: boolean;
};

/**
 * אחים של כרטיס שמולא בידי הורה (card_for=child): שאר כרטיסי הילדים של אותו
 * משתמש. service role, ולכן הקורא מחליט מי רואה: שדכן ומנהל (ובעלים).
 * לשדכן מוצגים רק כרטיסים מאושרים שאינם "בלעדיים למנהל".
 */
export async function loadCardSiblings(
  student: {
    id: string;
    user_id?: string | null;
    card_for?: string | null;
    birth_date?: string | null;
  },
  { isAdmin }: { isAdmin: boolean },
): Promise<CardSibling[]> {
  if (!student.user_id || student.card_for !== "child") return [];
  try {
    let query = createAdminClient()
      .from("students")
      .select(
        "id, first_name, last_name, gender, birth_date, personal_status, in_shidduchim",
      )
      .eq("user_id", student.user_id)
      .eq("card_for", "child")
      .neq("id", student.id)
      .is("deleted_at", null)
      .order("birth_date", { ascending: true, nullsFirst: false });
    if (!isAdmin) {
      query = query
        .not("admin_approved_at", "is", null)
        .is("admin_exclusive_at", null);
    }
    const { data, error } = await query;
    if (error) {
      console.error("[students/siblings] load failed", error.message);
      return [];
    }
    const own = student.birth_date ? new Date(student.birth_date).getTime() : null;
    return (data ?? []).map((row) => {
      const theirs = row.birth_date ? new Date(row.birth_date).getTime() : null;
      return {
        id: row.id,
        name: `${row.first_name} ${row.last_name}`.trim(),
        gender: row.gender,
        relativeAge:
          own === null || theirs === null
            ? null
            : theirs < own
              ? "older"
              : "younger",
        isInShidduchim:
          row.in_shidduchim !== false &&
          !["engaged", "married"].includes(row.personal_status),
      };
    });
  } catch (error) {
    console.error("[students/siblings] load failed", error);
    return [];
  }
}
