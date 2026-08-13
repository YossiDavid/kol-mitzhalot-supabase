"use server";

/**
 * Callers: contact page forms, NewsletterSignup footer.
 * API: inserts into contact_submissions, engagements, newsletter_subscribers.
 * Schema: public.contact_submissions / engagements / newsletter_subscribers.
 * User: "3. לחבר את הטפסים למערכת הניהול ולDB." + "6. כרגע צריך לחבר אותו לטבלה ב db"
 */

import { createClient } from "@/lib/supabase/public";

export type FormActionResult =
  | { ok: true }
  | { ok: false; error: string };

function str(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function submitContactForm(
  _prev: FormActionResult | null,
  formData: FormData,
): Promise<FormActionResult> {
  const name = str(formData, "name");
  const email = str(formData, "email");
  const phone = str(formData, "phone");
  const subject = str(formData, "subject");
  const message = str(formData, "message");

  if (!name || !email || !subject || !message) {
    return { ok: false, error: "נא למלא את כל השדות החובה" };
  }

  const supabase = createClient();
  const { error } = await supabase.from("contact_submissions").insert({
    type: "contact",
    name,
    email,
    phone: phone || null,
    subject,
    message,
    status: "new",
  });

  if (error) {
    console.error("contact submit failed", error);
    return { ok: false, error: "שליחת הפנייה נכשלה. נסו שוב מאוחר יותר." };
  }

  return { ok: true };
}

export async function submitEngagementForm(
  _prev: FormActionResult | null,
  formData: FormData,
): Promise<FormActionResult> {
  const groom_name = str(formData, "groom_name");
  const groom_father = str(formData, "groom_father");
  const groom_city = str(formData, "groom_city");
  const groom_yeshiva = str(formData, "groom_yeshiva");
  const bride_name = str(formData, "bride_name");
  const bride_father = str(formData, "bride_father");
  const bride_city = str(formData, "bride_city");
  const bride_seminary = str(formData, "bride_seminary");
  const closed_at = str(formData, "closed_at");
  const shadchan_name = str(formData, "shadchan_name");
  const submitter_name = str(formData, "submitter_name");
  const submitter_phone = str(formData, "submitter_phone");
  const submitter_email = str(formData, "submitter_email");

  if (
    !groom_name ||
    !groom_father ||
    !groom_city ||
    !bride_name ||
    !bride_father ||
    !bride_city ||
    !closed_at ||
    !submitter_name ||
    !submitter_phone ||
    !submitter_email
  ) {
    return { ok: false, error: "נא למלא את כל השדות החובה" };
  }

  const supabase = createClient();
  const { error } = await supabase.from("engagements").insert({
    groom_name,
    groom_father,
    groom_city,
    groom_yeshiva: groom_yeshiva || null,
    bride_name,
    bride_father,
    bride_city,
    bride_seminary: bride_seminary || null,
    closed_at: new Date(closed_at).toISOString(),
    shadchan_name: shadchan_name || null,
    submitter_name,
    submitter_phone,
    submitter_email,
    is_published: false,
  });

  if (error) {
    console.error("engagement submit failed", error);
    return { ok: false, error: "שליחת המודעה נכשלה. נסו שוב מאוחר יותר." };
  }

  return { ok: true };
}

export async function submitShidduchIdeaForm(
  _prev: FormActionResult | null,
  formData: FormData,
): Promise<FormActionResult> {
  const name = str(formData, "submitter_name");
  const email = str(formData, "submitter_email");
  const phone = str(formData, "submitter_phone");
  const accompany = str(formData, "accompany");
  const reason = str(formData, "reason");

  const payload = {
    intended_male: {
      name: str(formData, "male_name"),
      father: str(formData, "male_father"),
      city: str(formData, "male_city"),
      yeshiva: str(formData, "male_yeshiva"),
      age: str(formData, "male_age"),
      status: str(formData, "male_status"),
    },
    intended_female: {
      name: str(formData, "female_name"),
      father: str(formData, "female_father"),
      city: str(formData, "female_city"),
      seminary: str(formData, "female_seminary"),
      age: str(formData, "female_age"),
      status: str(formData, "female_status"),
    },
    reason,
    accompany: accompany === "yes",
  };

  if (
    !name ||
    !email ||
    !phone ||
    !payload.intended_male.name ||
    !payload.intended_male.father ||
    !payload.intended_male.city ||
    !payload.intended_male.age ||
    !payload.intended_male.status ||
    !payload.intended_female.name ||
    !payload.intended_female.father ||
    !payload.intended_female.city ||
    !payload.intended_female.age ||
    !payload.intended_female.status
  ) {
    return { ok: false, error: "נא למלא את כל השדות החובה" };
  }

  const supabase = createClient();
  const { error } = await supabase.from("contact_submissions").insert({
    type: "shidduch_idea",
    name,
    email,
    phone,
    subject: "רעיון לשידוך",
    message: reason || null,
    payload,
    status: "new",
  });

  if (error) {
    console.error("shidduch idea submit failed", error);
    return { ok: false, error: "שליחת הרעיון נכשלה. נסו שוב מאוחר יותר." };
  }

  return { ok: true };
}

export async function subscribeNewsletter(
  _prev: FormActionResult | null,
  formData: FormData,
): Promise<FormActionResult> {
  const email = str(formData, "email").toLowerCase();
  if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
    return { ok: false, error: "נא להזין כתובת מייל תקינה" };
  }

  const supabase = createClient();
  const { error } = await supabase.from("newsletter_subscribers").insert({
    email,
    source: "footer",
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: true };
    }
    console.error("newsletter subscribe failed", error);
    return { ok: false, error: "ההרשמה נכשלה. נסו שוב מאוחר יותר." };
  }

  return { ok: true };
}
