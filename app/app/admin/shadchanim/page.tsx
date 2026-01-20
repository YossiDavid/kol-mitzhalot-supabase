import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardSection } from "@/components/layout";
import { Box } from "@/components/layout";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { unstable_noStore as noStore } from 'next/cache';

type ShadchanStats = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  totalShidduchim: number;
  completedShidduchim: number;
  lastShidduchCreatedAt: string | null;
  lastShidduchCompletedAt: string | null;
};

async function getShadchanimStats(): Promise<ShadchanStats[]> {
  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch (error) {
    console.error("Admin client error:", error);
    throw error;
  }

  // שליפת כל המשתמשים עם role shadchan
  const { data: users, error: usersError } = await adminClient.auth.admin.listUsers();

  if (usersError || !users) {
    console.error("Error fetching users:", usersError);
    return [];
  }

  // סינון רק שדכנים (לא אדמינים)
  const shadchanim = users.users.filter(
    (user) => user.user_metadata?.role === "shadchan"
  );

  const supabase = await createClient();
  const stats: ShadchanStats[] = [];

  for (const user of shadchanim) {
    // שליפת סטטיסטיקות שידוכים
    const { data: shidduchim, error: shidduchimError } = await supabase
      .from("shidduchim")
      .select("created_at, status, updated_at")
      .eq("shadchan_id", user.id)
      .order("created_at", { ascending: false });

    if (shidduchimError) {
      console.error(`Error fetching shidduchim for user ${user.id}:`, shidduchimError);
    }

    const shidduchimData = shidduchim || [];
    const completedShidduchim = shidduchimData.filter(
      (s) => s.status === "completed"
    );

    const lastShidduch = shidduchimData[0] || null;
    const lastCompletedShidduch = completedShidduchim[0] || null;

    stats.push({
      id: user.id,
      firstName: user.user_metadata?.firstName || null,
      lastName: user.user_metadata?.lastName || null,
      email: user.email || null,
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at || null,
      totalShidduchim: shidduchimData.length,
      completedShidduchim: completedShidduchim.length,
      lastShidduchCreatedAt: lastShidduch?.created_at || null,
      lastShidduchCompletedAt: lastCompletedShidduch?.updated_at || null,
    });
  }

  // מיון לפי תאריך הצטרפות (הכי חדש ראשון)
  return stats.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
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

export default async function ShadchanimPage() {
  noStore();
  let stats: ShadchanStats[] = [];
  let error: Error | null = null;

  try {
    stats = await getShadchanimStats();
  } catch (err) {
    error = err instanceof Error ? err : new Error("Unknown error");
    console.error("Error in ShadchanimPage:", error);
  }

  if (error) {
    const isServiceRoleKeyError = error.message.includes("SUPABASE_SERVICE_ROLE_KEY");

    return (
      <div className="space-y-10 py-4">
        <DashboardSection
          title="שגיאה"
          subTitle="אירעה שגיאה בטעינת השדכנים"
          button={<Button asChild><Link href="/app/admin">חזרה לדף הבית</Link></Button>}
        >
          <div className="mt-6 p-6 border border-destructive rounded-lg bg-destructive/10">
            <h3 className="text-lg font-semibold text-destructive mb-2">
              שגיאה בהגדרת האדמין
            </h3>
            {isServiceRoleKeyError ? (
              <div className="space-y-4">
                <p className="text-sm">
                  המשתנה <code className="bg-muted px-2 py-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code> לא מוגדר.
                </p>
                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <p className="font-semibold">הוראות התקנה:</p>
                  <ol className="list-decimal list-inside space-y-1 text-sm">
                    <li>פתח את קובץ <code className="bg-background px-1 rounded">.env.local</code> בתיקיית הפרויקט</li>
                    <li>הוסף את השורה: <code className="bg-background px-1 rounded">SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here</code></li>
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
                    <li>הפעל מחדש את שרת הפיתוח (<code className="bg-background px-1 rounded">npm run dev</code>)</li>
                  </ol>
                </div>
                <p className="text-xs text-muted-foreground">
                  ⚠️ ה-Service Role Key רגיש מאוד - אל תחלוק אותו או תעלה אותו ל-Git
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
        title="כל השדכנים"
        titleNumber={stats.length}
        subTitle="רשימת כל השדכנים במערכת עם סטטיסטיקות"
        button={<Button asChild><Link href="/app/admin">חזרה לדף הבית</Link></Button>}
      >
        {stats.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            לא נמצאו שדכנים במערכת
          </div>
        ) : (
          <div className="grid grid-cols-[2fr_2fr_2fr_1fr_1fr_1fr_1fr_2fr_2fr_2fr] gap-4 pt-4">
            <div
              data-slot="table-header"
              className="col-span-full grid grid-cols-subgrid font-semibold"
            >
              <div>שם פרטי</div>
              <div>שם משפחה</div>
              <div>אימייל</div>
              <div>תאריך הצטרפות</div>
              <div>שידוכים נוצרו</div>
              <div>שידוכים נסגרו</div>
              <div>הצעה אחרונה</div>
              <div>שידוך אחרון נסגר</div>
              <div>התחברות אחרונה</div>
            </div>
            {stats.map((shadchan) => (
              <Box
                key={shadchan.id}
                className="col-span-full grid grid-cols-subgrid items-center"
              >
                <div>{shadchan.firstName || "לא זמין"}</div>
                <div>{shadchan.lastName || "לא זמין"}</div>
                <div className="text-sm">{shadchan.email || "לא זמין"}</div>
                <div className="text-sm">{formatDate(shadchan.createdAt)}</div>
                <div className="text-center">{shadchan.totalShidduchim}</div>
                <div className="text-center">{shadchan.completedShidduchim}</div>
                <div className="text-sm">
                  {formatDate(shadchan.lastShidduchCreatedAt)}
                </div>
                <div className="text-sm">
                  {formatDate(shadchan.lastShidduchCompletedAt)}
                </div>
                <div className="text-sm">
                  {formatDate(shadchan.lastSignInAt)}
                </div>
              </Box>
            ))}
          </div>
        )}
      </DashboardSection>
    </div>
  );
}
