import { unstable_noStore as noStore } from "next/cache";
import { NextResponse } from "next/server";

import { fetchAllAuthUsers } from "@/features/admin/lib/users";
import { toCsv } from "@/features/admin/lib/users-csv";
import {
  formatSignupPurposeLabel,
  readSignupPurpose,
  readSignupPurposeOther,
} from "@/features/auth/lib/signup-purpose";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getRoleLabel, getRoles, hasRole } from "@/lib/user";
import { resolveDisplayName } from "@/lib/user-display-name";

const HEADER = [
  "שם פרטי",
  "שם משפחה",
  "אימייל",
  "טלפון",
  "עיר",
  "מטרת הרשמה",
  "תפקידים",
  "מספר כרטיסים",
  "תאריך הצטרפות",
  "נראה לאחרונה",
] as const;

const dateIL = (iso: string | null | undefined) =>
  iso
    ? new Intl.DateTimeFormat("he-IL", { timeZone: "Asia/Jerusalem" }).format(new Date(iso))
    : "";

/**
 * GET: רשימת תפוצה - כל הנרשמים עם פרטי קשר ומידע בסיסי, כקובץ CSV לאקסל.
 * מנהל בלבד. נתונים אישיים: לא נשמר בשרת, נוצר לכל הורדה.
 */
export async function GET() {
  noStore();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRole(user, "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const admin = createAdminClient();
    const users = await fetchAllAuthUsers(admin);
    const [{ data: profiles, error: profilesError }, { data: cards, error: cardsError }] =
      await Promise.all([
        admin.from("user_profiles").select("id, first_name, last_name, city, last_seen_at"),
        admin.from("students").select("user_id").is("deleted_at", null),
      ]);
    if (profilesError || cardsError) {
      console.error("[admin/users/export] load failed", profilesError ?? cardsError);
      return NextResponse.json({ error: "הייצוא נכשל" }, { status: 500 });
    }
    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
    const cardCount = new Map<string, number>();
    for (const card of cards ?? []) {
      cardCount.set(card.user_id, (cardCount.get(card.user_id) ?? 0) + 1);
    }

    const body = [...users]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((u) => {
        const profile = profileById.get(u.id) ?? null;
        const { firstName, lastName } = resolveDisplayName(u, profile);
        return [
          firstName ?? "",
          lastName ?? "",
          u.email ?? "",
          u.phone || (u.user_metadata?.phone as string | undefined) || "",
          profile?.city ?? "",
          formatSignupPurposeLabel(readSignupPurpose(u), readSignupPurposeOther(u)),
          getRoles(u).map((role) => getRoleLabel(role)).join(" + "),
          cardCount.get(u.id) ?? 0,
          dateIL(u.created_at),
          dateIL(profile?.last_seen_at),
        ];
      });

    const csv = toCsv([HEADER, ...body]);
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="kol-mitzhalot-users-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[admin/users/export] unexpected error", error);
    return NextResponse.json({ error: "הייצוא נכשל" }, { status: 500 });
  }
}
