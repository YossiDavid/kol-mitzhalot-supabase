import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveRole, getRoles, type Role } from "@/lib/user";

export type UserDetails = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  roles: Role[];
  staffInstitutionId: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  children: Array<{
    id: string;
    firstName: string;
    lastName: string;
    gender: "male" | "female";
    birthDate: string;
    city: string;
    inShidduchim: boolean | null;
  }>;
  shidduchimStats: {
    totalOffered: number;
    totalCompleted: number;
    byChild: Array<{
      childId: string;
      childName: string;
      offered: number;
      completed: number;
    }>;
  };
};

export type UserChildRow = UserDetails["children"][number];

export function formatUserDate(dateString: string | null): string {
  if (!dateString) return "לא זמין";
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("he-IL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export async function getUserDetails(
  userId: string,
): Promise<UserDetails | null> {
  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch (error) {
    console.error("Admin client error:", error);
    throw error;
  }

  // שליפת פרטי המשתמש
  const {
    data: { user },
    error: userError,
  } = await adminClient.auth.admin.getUserById(userId);

  if (userError || !user) {
    return null;
  }

  const supabase = await createClient();

  // שליפת מוסד הלימודים הקיים של המשתמש (אם הוא איש צוות) כדי למלא מראש את
  // בורר המוסד ב-UserRolesEditor. משתמשים ב-admin client כי מדובר ברשומת
  // staff_info של משתמש אחר, ו-RLS מתירה קריאה כזו רק למנהל (או לבעל הרשומה).
  const { data: staffInfo, error: staffInfoError } = await adminClient
    .from("staff_info")
    .select("institution_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (staffInfoError) {
    console.error("Error fetching staff_info:", staffInfoError);
  }

  // שליפת ילדים
  const { data: children, error: childrenError } = await supabase
    .from("students")
    .select(
      "id, first_name, last_name, gender, birth_date, city, in_shidduchim",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (childrenError) {
    console.error("Error fetching children:", childrenError);
  }

  const childrenData = children || [];
  const studentIds = childrenData.map((c) => c.id);

  const shidduchimStats: UserDetails["shidduchimStats"] = {
    totalOffered: 0,
    totalCompleted: 0,
    byChild: [],
  };

  if (studentIds.length > 0) {
    // שליפת שידוכים שבהם אחד הילדים הוא חתן
    const { data: groomShidduchim } = await supabase
      .from("shidduchim")
      .select("id, groom_id, bride_id, status")
      .in("groom_id", studentIds);

    // שליפת שידוכים שבהם אחד הילדים הוא כלה
    const { data: brideShidduchim } = await supabase
      .from("shidduchim")
      .select("id, groom_id, bride_id, status")
      .in("bride_id", studentIds);

    // איחוד התוצאות והסרת כפילויות לפי id
    const allShidduchim = [
      ...(groomShidduchim || []),
      ...(brideShidduchim || []),
    ];
    const uniqueShidduchim = allShidduchim.filter(
      (s, index, self) => index === self.findIndex((t) => t.id === s.id),
    );

    const offeredNonDraft = uniqueShidduchim.filter(
      (s) => s.status !== "draft",
    );
    shidduchimStats.totalOffered = offeredNonDraft.length;
    shidduchimStats.totalCompleted = offeredNonDraft.filter(
      (s) => s.status === "completed",
    ).length;

    // חישוב לפי ילד
    for (const child of childrenData) {
      const childShidduchim = uniqueShidduchim.filter(
        (s) => s.groom_id === child.id || s.bride_id === child.id,
      );
      const childNonDraft = childShidduchim.filter((s) => s.status !== "draft");
      shidduchimStats.byChild.push({
        childId: child.id,
        childName: `${child.first_name} ${child.last_name}`,
        offered: childNonDraft.length,
        completed: childNonDraft.filter((s) => s.status === "completed").length,
      });
    }
  }

  return {
    id: user.id,
    firstName: user.user_metadata?.firstName || null,
    lastName: user.user_metadata?.lastName || null,
    email: user.email || null,
    phone: user.phone || null,
    role: getEffectiveRole(user),
    roles: getRoles(user),
    staffInstitutionId: staffInfo?.institution_id ?? null,
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at || null,
    children: childrenData.map((c) => ({
      id: c.id,
      firstName: c.first_name,
      lastName: c.last_name,
      gender: c.gender,
      birthDate: c.birth_date,
      city: c.city,
      inShidduchim: c.in_shidduchim,
    })),
    shidduchimStats,
  };
}
