import type { SupabaseClient } from "@supabase/supabase-js";

import { approvedCard } from "./approved-card";

/**
 * כרטיס מאושר שעובר את כל שדות החובה בטופס העריכה, כדי ש"שמירת שינויים"
 * תצליח (השמירה מאמתת את כל הטופס). extra דורס או מוסיף עמודות.
 */
const nameParts = (name: string) => ({ prefix: "", name, suffix: "" });

export async function insertCompleteCard(
  admin: SupabaseClient,
  params: {
    userId: string;
    firstName: string;
    lastName: string;
    gender?: "male" | "female";
    fatherName?: string;
    authorEmail?: string;
    extra?: Record<string, unknown>;
  },
): Promise<string> {
  const { data, error } = await admin
    .from("students")
    .insert(
      approvedCard({
        user_id: params.userId,
        first_name: params.firstName,
        last_name: params.lastName,
        identity_number: `7${String(Date.now()).slice(-8)}`,
        card_for: "child",
        birth_date: "1997-03-03",
        gender: params.gender ?? "female",
        personal_status: "single",
        country: "ישראל",
        city: "בני ברק",
        street: "רבי עקיבא",
        house: "12",
        cellphone_type: "kosher",
        in_shidduchim: true,
        parents_info: {
          father: {
            self: nameParts(params.fatherName ?? "אברהם"),
            phone: "0501111111",
            job: "מלמד",
            email: "",
            grandFather: nameParts("יצחק"),
            grandMother: nameParts("שרה"),
          },
          mother: {
            self: nameParts("רחל"),
            maidenName: "לוי",
            phone: "0502222222",
            job: "מורה",
            email: "",
            grandFather: nameParts("יעקב"),
            grandMother: nameParts("לאה"),
          },
        },
        family_info: {
          numberOfChildren: 6,
          currentChildPlace: 2,
          about: "משפחה תורנית",
          mechutanim: [],
        },
        author_info: {
          name: "כותב הבדיקה",
          phone: "0503333333",
          email: params.authorEmail ?? "author-edit@example.test",
          relation: "אב",
        },
        ...params.extra,
      }),
    )
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`יצירת כרטיס הבדיקה נכשלה: ${error?.message}`);
  }
  const id = data.id as string;

  const { error: preferencesError } = await admin
    .from("partner_preferences")
    .insert({ student_id: id, additional_information: "מחפשים בת תורה" });
  if (preferencesError) {
    throw new Error(`הכנת העדפות הכרטיס נכשלה: ${preferencesError.message}`);
  }
  return id;
}
