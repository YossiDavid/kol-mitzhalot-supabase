import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardSection } from "@/components/layout";
import { Box } from "@/components/layout";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { notFound } from "next/navigation";
import calculateAge from "@/lib/calculateAge";
import { unstable_noStore as noStore } from "next/cache";

type UserDetails = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
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

async function getUserDetails(userId: string): Promise<UserDetails | null> {
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

  // שליפת שידוכים
  let shidduchimStats = {
    totalOffered: 0,
    totalCompleted: 0,
    byChild: [] as Array<{
      childId: string;
      childName: string;
      offered: number;
      completed: number;
    }>,
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

    shidduchimStats.totalOffered = uniqueShidduchim.length;
    shidduchimStats.totalCompleted = uniqueShidduchim.filter(
      (s) => s.status === "completed",
    ).length;

    // חישוב לפי ילד
    for (const child of childrenData) {
      const childShidduchim = uniqueShidduchim.filter(
        (s) => s.groom_id === child.id || s.bride_id === child.id,
      );
      shidduchimStats.byChild.push({
        childId: child.id,
        childName: `${child.first_name} ${child.last_name}`,
        offered: childShidduchim.length,
        completed: childShidduchim.filter((s) => s.status === "completed")
          .length,
      });
    }
  }

  return {
    id: user.id,
    firstName: user.user_metadata?.firstName || null,
    lastName: user.user_metadata?.lastName || null,
    email: user.email || null,
    phone: user.phone || null,
    role: user.user_metadata?.role || "user",
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

function formatDate(dateString: string | null): string {
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

function getRoleLabel(role: string | null): string {
  switch (role) {
    case "admin":
      return "מנהל";
    case "shadchan":
      return "שדכן";
    case "user":
      return "משתמש";
    default:
      return "משתמש";
  }
}

export default async function UserDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  noStore();
  const { id } = await params;
  let userDetails: UserDetails | null = null;
  let error: Error | null = null;

  try {
    userDetails = await getUserDetails(id);
  } catch (err) {
    error = err instanceof Error ? err : new Error("Unknown error");
    console.error("Error in UserDetailsPage:", error);
  }

  if (error) {
    const isServiceRoleKeyError = error.message.includes(
      "SUPABASE_SERVICE_ROLE_KEY",
    );

    return (
      <div className="space-y-10 py-4">
        <DashboardSection
          title="שגיאה"
          subTitle="אירעה שגיאה בטעינת פרטי המשתמש"
          button={
            <Button asChild variant="outline">
              <Link href="/app/admin/users">חזרה לרשימת המשתמשים</Link>
            </Button>
          }
        >
          <div className="border-destructive bg-destructive/10 mt-6 rounded-lg border p-6">
            <h3 className="text-destructive mb-2 text-lg font-semibold">
              שגיאה בהגדרת האדמין
            </h3>
            {isServiceRoleKeyError ? (
              <div className="space-y-4">
                <p className="text-sm">
                  המשתנה{" "}
                  <code className="bg-muted rounded px-2 py-1">
                    SUPABASE_SERVICE_ROLE_KEY
                  </code>{" "}
                  לא מוגדר.
                </p>
                <div className="bg-muted space-y-2 rounded-lg p-4">
                  <p className="font-semibold">הוראות התקנה:</p>
                  <ol className="list-inside list-decimal space-y-1 text-sm">
                    <li>
                      פתח את קובץ{" "}
                      <code className="bg-background rounded px-1">
                        .env.local
                      </code>{" "}
                      בתיקיית הפרויקט
                    </li>
                    <li>
                      הוסף את השורה:{" "}
                      <code className="bg-background rounded px-1">
                        SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
                      </code>
                    </li>
                    <li>
                      מצא את ה-Service Role Key ב-{" "}
                      <a
                        href="https://supabase.com/dashboard/project/_/settings/api"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline"
                      >
                        Supabase Dashboard → Settings → API
                      </a>
                    </li>
                    <li>
                      הפעל מחדש את שרת הפיתוח (
                      <code className="bg-background rounded px-1">
                        npm run dev
                      </code>
                      )
                    </li>
                  </ol>
                </div>
                <p className="text-muted-foreground text-xs">
                  ⚠️ ה-Service Role Key רגיש מאוד - אל תחלוק אותו או תעלה אותו
                  ל-Git
                </p>
              </div>
            ) : (
              <p className="text-sm">{error.message}</p>
            )}
          </div>
        </DashboardSection>
      </div>
    );
  }

  if (!userDetails) {
    notFound();
  }

  return (
    <div className="space-y-10 py-4">
      <DashboardSection
        title={`פרטי משתמש: ${userDetails.firstName} ${userDetails.lastName}`}
        subTitle="מידע מפורט על המשתמש"
        button={
          <Button asChild variant="outline">
            <Link href="/app/admin/users">חזרה לרשימת המשתמשים</Link>
          </Button>
        }
      >
        <div className="mt-6 space-y-6">
          {/* מידע בסיסי */}
          <Box>
            <h3 className="mb-4 text-lg font-semibold">מידע בסיסי</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-muted-foreground">שם פרטי:</span>{" "}
                {userDetails.firstName || "לא זמין"}
              </div>
              <div>
                <span className="text-muted-foreground">שם משפחה:</span>{" "}
                {userDetails.lastName || "לא זמין"}
              </div>
              <div>
                <span className="text-muted-foreground">אימייל:</span>{" "}
                {userDetails.email || "לא זמין"}
              </div>
              <div>
                <span className="text-muted-foreground">טלפון:</span>{" "}
                {userDetails.phone || "לא זמין"}
              </div>
              <div>
                <span className="text-muted-foreground">תפקיד:</span>{" "}
                {getRoleLabel(userDetails.role)}
              </div>
              <div>
                <span className="text-muted-foreground">תאריך הצטרפות:</span>{" "}
                {formatDate(userDetails.createdAt)}
              </div>
              <div>
                <span className="text-muted-foreground">התחברות אחרונה:</span>{" "}
                {formatDate(userDetails.lastSignInAt)}
              </div>
            </div>
          </Box>

          {/* סטטיסטיקות שידוכים */}
          <Box>
            <h3 className="mb-4 text-lg font-semibold">סטטיסטיקות שידוכים</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-muted-foreground">
                  סה"כ שידוכים שהוצעו:
                </span>{" "}
                <strong>{userDetails.shidduchimStats.totalOffered}</strong>
              </div>
              <div>
                <span className="text-muted-foreground">
                  סה"כ שידוכים שנסגרו:
                </span>{" "}
                <strong>{userDetails.shidduchimStats.totalCompleted}</strong>
              </div>
            </div>
          </Box>

          {/* ילדים */}
          <Box>
            <h3 className="mb-4 text-lg font-semibold">
              ילדים במערכת ({userDetails.children.length})
            </h3>
            {userDetails.children.length === 0 ? (
              <p className="text-muted-foreground">אין ילדים רשומים במערכת</p>
            ) : (
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-4 pt-4">
                <div
                  data-slot="table-header"
                  className="col-span-full grid grid-cols-subgrid font-semibold"
                >
                  <div>שם</div>
                  <div>מגדר</div>
                  <div>גיל</div>
                  <div>עיר</div>
                  <div>שידוכים הוצעו</div>
                  <div>שידוכים נסגרו</div>
                </div>
                {userDetails.children.map((child) => {
                  const stats = userDetails.shidduchimStats.byChild.find(
                    (s) => s.childId === child.id,
                  ) || { offered: 0, completed: 0 };
                  return (
                    <div
                      key={child.id}
                      className="col-span-full grid grid-cols-subgrid items-center border-b p-2"
                    >
                      <div>
                        <Link
                          href={`/app/students/${child.id}`}
                          className="text-primary hover:underline"
                        >
                          {child.firstName} {child.lastName}
                        </Link>
                      </div>
                      <div>{child.gender === "male" ? "זכר" : "נקבה"}</div>
                      <div>{calculateAge(new Date(child.birthDate))}</div>
                      <div>{child.city}</div>
                      <div className="text-center">{stats.offered}</div>
                      <div className="text-center">{stats.completed}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </Box>
        </div>
      </DashboardSection>
    </div>
  );
}
