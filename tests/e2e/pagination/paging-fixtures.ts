import type { SupabaseClient } from "@supabase/supabase-js";

import { setShadchanApproval } from "../forums/forum-fixtures";
import { approvedCard } from "../helpers/approved-card";

/**
 * עוזרים לבדיקות העימוד. כל בדיקה מקימה משתמשים ייעודיים (הורה ושדכן שלא
 * משמשים אף קובץ אחר), כך שהסך הכל ברשימות שלהם הוא בדיוק מה שנזרע - גם
 * כשבמסד המקומי נשארו שורות מבדיקות אחרות.
 */

export const PAGE_SIZE = 20;

type DedicatedUser = {
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  roles: string[];
};

export const PAGING_PARENT: DedicatedUser = {
  email: "playwright-paging-parent@kol-mitzhalot.test",
  phone: "+972500000051",
  firstName: "עימוד",
  lastName: "הורה",
  roles: [],
};

export const PAGING_SHADCHAN: DedicatedUser = {
  email: "playwright-paging-shadchan@kol-mitzhalot.test",
  phone: "+972500000052",
  firstName: "עימוד",
  lastName: "שדכן",
  roles: ["shadchan"],
};

/** יוצר את המשתמש אם אינו קיים (נשאר להרצות הבאות), ומחזיר את המזהה שלו */
export async function ensureDedicatedUser(
  admin: SupabaseClient,
  user: DedicatedUser,
): Promise<string> {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  let id = data?.users.find((u) => u.email === user.email)?.id;

  if (!id) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email: user.email,
      phone: user.phone,
      email_confirm: true,
      phone_confirm: true,
      app_metadata: user.roles.length ? { roles: user.roles } : undefined,
      user_metadata: {
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        phone_verified: true,
      },
    });
    if (error || !created.user) {
      throw new Error(`יצירת ${user.email} נכשלה: ${error?.message}`);
    }
    id = created.user.id;
  }

  // שער השם של ה-middleware דורש שורת פרופיל
  await admin.from("user_profiles").upsert({
    id,
    first_name: user.firstName,
    last_name: user.lastName,
  });
  if (user.roles.includes("shadchan")) {
    await setShadchanApproval(admin, id, "approved");
  }
  return id;
}

/** מחרוזת ייחודית להרצה, לשמות שמזהים את שורות הבדיקה */
export function runToken(): string {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

export const twoDigits = (index: number) => String(index).padStart(2, "0");

export async function insertCards(
  admin: SupabaseClient,
  rows: {
    userId: string;
    gender: "male" | "female";
    firstName: string;
    lastName: string;
  }[],
): Promise<string[]> {
  const { data, error } = await admin
    .from("students")
    .insert(
      approvedCard(
        rows.map((row) => ({
          user_id: row.userId,
          first_name: row.firstName,
          last_name: row.lastName,
          birth_date: "1998-01-01",
          gender: row.gender,
          personal_status: "single",
          country: "ישראל",
          city: "בני ברק",
          in_shidduchim: true,
        })),
      ),
    )
    .select("id, last_name");
  if (error || !data) {
    throw new Error(`יצירת כרטיסי בדיקה נכשלה: ${error?.message}`);
  }
  // מחזיר לפי סדר הקלט, גם אם השרת החזיר בסדר אחר
  const idByName = new Map(data.map((r) => [r.last_name as string, r.id]));
  return rows.map((row) => idByName.get(row.lastName) as string);
}

const MINUTE_MS = 60_000;

/**
 * הצעות של שדכן אחד לכרטיס חתן אחד, מול כלות שונות. ההצעה במקום i היא ה-i
 * החדשה ביותר (sent_at / updated_at יורדים עם i), כך שסדר התצוגה צפוי.
 */
export async function seedProposals(
  admin: SupabaseClient,
  params: {
    shadchanId: string;
    groomId: string;
    brideIds: string[];
    status: "sent" | "draft";
  },
): Promise<string[]> {
  const base = Date.now() - 60 * MINUTE_MS;
  const rows = params.brideIds.map((brideId, index) => {
    const at = new Date(base - index * MINUTE_MS).toISOString();
    return params.status === "sent"
      ? {
          groom_id: params.groomId,
          bride_id: brideId,
          shadchan_id: params.shadchanId,
          status: "sent",
          recipient_scope: "both",
          sent_at: at,
          created_at: at,
        }
      : {
          groom_id: params.groomId,
          bride_id: brideId,
          shadchan_id: params.shadchanId,
          status: "draft",
          recipient_scope: null,
          sent_at: null,
          created_at: at,
          updated_at: at,
        };
  });
  const { data, error } = await admin
    .from("shidduchim")
    .insert(rows)
    .select("id");
  if (error || !data) {
    throw new Error(`יצירת הצעות בדיקה נכשלה: ${error?.message}`);
  }
  return data.map((row) => row.id as string);
}
