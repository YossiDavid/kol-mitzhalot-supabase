import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardSection } from "@/components/layout";
import { Box } from "@/components/layout";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";

type UserStats = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  role: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  childrenCount: number;
  shidduchimOfferedCount: number;
  shidduchimCompletedCount: number;
};

async function getUsersStats(): Promise<UserStats[]> {
  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch (error) {
    console.error("Admin client error:", error);
    throw error;
  }

  // שליפת כל המשתמשים
  const { data: users, error: usersError } =
    await adminClient.auth.admin.listUsers();

  if (usersError || !users) {
    console.error("Error fetching users:", usersError);
    return [];
  }

  const supabase = await createClient();
  const stats: UserStats[] = [];

  for (const user of users.users) {
    const role = user.user_metadata?.role || "user";

    // ספירת ילדים
    const { count: childrenCount } = await supabase
      .from("students")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    // ספירת שידוכים שהוצעו (כל השידוכים שקשורים לילדים שלו)
    const { data: userStudents } = await supabase
      .from("students")
      .select("id")
      .eq("user_id", user.id);

    const studentIds = userStudents?.map((s) => s.id) || [];

    let shidduchimOfferedCount = 0;
    let shidduchimCompletedCount = 0;

    if (studentIds.length > 0) {
      // שליפת שידוכים שבהם אחד הילדים הוא חתן
      const { data: groomShidduchim } = await supabase
        .from("shidduchim")
        .select("id, status")
        .in("groom_id", studentIds);

      // שליפת שידוכים שבהם אחד הילדים הוא כלה
      const { data: brideShidduchim } = await supabase
        .from("shidduchim")
        .select("id, status")
        .in("bride_id", studentIds);

      // איחוד התוצאות והסרת כפילויות לפי id
      const allShidduchim = [
        ...(groomShidduchim || []),
        ...(brideShidduchim || []),
      ];
      const uniqueShidduchim = allShidduchim.filter(
        (s, index, self) => index === self.findIndex((t) => t.id === s.id),
      );

      shidduchimOfferedCount = uniqueShidduchim.length;
      shidduchimCompletedCount = uniqueShidduchim.filter(
        (s) => s.status === "completed",
      ).length;
    }

    stats.push({
      id: user.id,
      firstName: user.user_metadata?.firstName || null,
      lastName: user.user_metadata?.lastName || null,
      email: user.email || null,
      role,
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at || null,
      childrenCount: childrenCount || 0,
      shidduchimOfferedCount,
      shidduchimCompletedCount,
    });
  }

  // מיון לפי תאריך הצטרפות (הכי חדש ראשון)
  return stats.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
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

export default async function UsersPage() {
  noStore();
  let stats: UserStats[] = [];
  let error: Error | null = null;

  try {
    stats = await getUsersStats();
  } catch (err) {
    error = err instanceof Error ? err : new Error("Unknown error");
    console.error("Error in UsersPage:", error);
  }

  if (error) {
    const isServiceRoleKeyError = error.message.includes(
      "SUPABASE_SERVICE_ROLE_KEY",
    );

    return (
      <div className="space-y-10 py-4">
        <DashboardSection
          title="שגיאה"
          subTitle="אירעה שגיאה בטעינת המשתמשים"
          button={
            <Button asChild>
              <Link href="/app/admin">חזרה לדף הבית</Link>
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

  return (
    <div className="space-y-10 py-4">
      <DashboardSection
        title="כל המשתמשים"
        titleNumber={stats.length}
        subTitle="רשימת כל המשתמשים במערכת"
        button={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/app/admin">חזרה לדף הבית</Link>
            </Button>
            <Button asChild>
              <Link href="/app/admin/users/create">יצירת משתמש חדש</Link>
            </Button>
          </div>
        }
      >
        {stats.length === 0 ? (
          <div className="text-muted-foreground py-10 text-center">
            לא נמצאו משתמשים במערכת
          </div>
        ) : (
          <div className="grid grid-cols-[2fr_2fr_2fr_1fr_1fr_1fr_1fr_1fr_2fr] gap-4 pt-4">
            <div
              data-slot="table-header"
              className="col-span-full grid grid-cols-subgrid font-semibold"
            >
              <div>שם פרטי</div>
              <div>שם משפחה</div>
              <div>אימייל</div>
              <div>תפקיד</div>
              <div>ילדים</div>
              <div>שידוכים הוצעו</div>
              <div>שידוכים נסגרו</div>
              <div>תאריך הצטרפות</div>
              <div>פעולות</div>
            </div>
            {stats.map((user) => (
              <Box
                key={user.id}
                className="col-span-full grid grid-cols-subgrid items-center"
              >
                <div>{user.firstName || "לא זמין"}</div>
                <div>{user.lastName || "לא זמין"}</div>
                <div className="text-sm">{user.email || "לא זמין"}</div>
                <div>{getRoleLabel(user.role)}</div>
                <div className="text-center">{user.childrenCount}</div>
                <div className="text-center">{user.shidduchimOfferedCount}</div>
                <div className="text-center">
                  {user.shidduchimCompletedCount}
                </div>
                <div className="text-sm">{formatDate(user.createdAt)}</div>
                <div>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/app/admin/users/${user.id}`}>צפייה</Link>
                  </Button>
                </div>
              </Box>
            ))}
          </div>
        )}
      </DashboardSection>
    </div>
  );
}
