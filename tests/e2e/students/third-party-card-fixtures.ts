import type { SupabaseClient } from "@supabase/supabase-js";

/** ערכים מובחנים: הבדיקות מחפשות אותם בתוכן העמוד כדי לוודא שנשלחו או לא */
export const SEEDED = {
  about: "טקסט-אופי-חבוי-8841",
  fatherName: "אברהם-שם-אב",
  fatherJob: "עיסוק-אב-חבוי-5523",
  motherJob: "עיסוק-אם-חבוי-7710",
  familyAbout: "סגנון-משפחה-חבוי-3392",
  referenceName: "ממליץ-חבוי-6604",
  partnerAbout: "מה-מחפשים-חבוי-2217",
  previousPartnerName: "בן-זוג-קודם-חבוי-9051",
  institutionName: "ישיבה-בסיסית-1180",
  fillReason: "הסבר-ממלא-חבוי-4467",
  city: "עיר-בסיסית-שלישית",
} as const;

export const FILLER_NAME = "שדכנית בדיקה";

type SeedOptions = {
  ownerId: string;
  lastName: string;
  gender?: "male" | "female";
  /** self / child / other / null (כרטיס ישן) */
  cardFor?: string | null;
  firstName?: string;
};

/**
 * כרטיס מלא עם נתונים בסיסיים ורגישים בכל הטבלאות, כדי שאפשר יהיה לבדוק מה
 * מגיע לכל צופה. נוצר ב-service role: כרטיס 'other' מתחיל בלי אישורים.
 */
export async function seedFullCard(
  admin: SupabaseClient,
  options: SeedOptions,
): Promise<string> {
  const { data, error } = await admin
    .from("students")
    .insert({
      user_id: options.ownerId,
      card_for: options.cardFor === undefined ? "other" : options.cardFor,
      first_name: options.firstName ?? "שלישית",
      last_name: options.lastName,
      birth_date: "1996-03-01",
      gender: options.gender ?? "female",
      personal_status: "single",
      country: "ישראל",
      city: SEEDED.city,
      community: "בעלזא",
      height: 165,
      in_shidduchim: true,
      about: SEEDED.about,
      parents_info: {
        status: "married",
        father: {
          self: { name: SEEDED.fatherName },
          job: SEEDED.fatherJob,
          phone: "0501119999",
        },
        mother: { self: { name: "שרה-שם-אם" }, job: SEEDED.motherJob },
      },
      family_info: { about: SEEDED.familyAbout, numberOfChildren: 7 },
      author_info: {
        name: FILLER_NAME,
        phone: "0527654321",
        relation: "שדכן/ית",
        relationType: "shadchan",
        knowsWell: true,
        fillReason: SEEDED.fillReason,
      },
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`יצירת כרטיס לבדיקה נכשלה: ${error?.message}`);
  }
  const id = data.id as string;

  const inserts = await Promise.all([
    admin.from("education_history").insert({
      student_id: id,
      institution_type: options.gender === "male" ? "yeshiva_gdola" : "seminar",
      name: SEEDED.institutionName,
    }),
    admin.from("references").insert({
      student_id: id,
      reference_type: "friend",
      name: SEEDED.referenceName,
      phone: "0501112222",
    }),
    admin.from("partner_preferences").insert({
      student_id: id,
      about_partner: SEEDED.partnerAbout,
    }),
    admin.from("previous_partners").insert({
      student_id: id,
      separation_type: "divorce",
      full_name: SEEDED.previousPartnerName,
    }),
  ]);
  const failed = inserts.find((result) => result.error);
  if (failed?.error) {
    throw new Error(`הזנת נתוני הכרטיס נכשלה: ${failed.error.message}`);
  }
  return id;
}

/** מה שה-migration עושה לכרטיסי 'other' שקיימים: שני האישורים, בלי מאשר */
export async function grandfatherCard(
  admin: SupabaseClient,
  studentId: string,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await admin
    .from("students")
    .update({
      third_party_full_display_approved_at: now,
      third_party_proposals_approved_at: now,
    })
    .eq("id", studentId)
    .eq("card_for", "other");
  if (error) throw new Error(`הענקת אישורים נכשלה: ${error.message}`);
}

export async function deleteCards(
  admin: SupabaseClient,
  ids: readonly string[],
): Promise<void> {
  if (ids.length === 0) return;
  await admin
    .from("shidduchim")
    .delete()
    .or(`groom_id.in.(${ids.join(",")}),bride_id.in.(${ids.join(",")})`);
  await admin
    .from("students")
    .delete()
    .in("id", [...ids]);
}
