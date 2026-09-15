import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Page, PageHeader } from "@/components/layout";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/card-skeleton";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import calculateAge from "@/lib/calculateAge";
import { unstable_noStore as noStore } from "next/cache";
import { getEffectiveRole, getRoleLabel, getRoles } from "@/lib/user";
import type { Role } from "@/lib/user";
import { UserRolesEditor } from "@/features/admin/components/user-roles-editor";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Suspense } from "react";

// מספר קופסאות השלד בזמן הטעינה - מקרב את מבנה הדף האמיתי (מידע, תפקידים,
// סטטיסטיקות וילדים) ומונע קפיצת פריסה.
const FALLBACK_SECTION_COUNT = 4;

type UserDetailsPageProps = {
  params: Promise<{ id: string }>;
};

type UserDetails = {
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

type ChildRow = UserDetails["children"][number];

function childColumns(
  byChild: UserDetails["shidduchimStats"]["byChild"],
): DataTableColumn<ChildRow>[] {
  const statsFor = (childId: string) =>
    byChild.find((s) => s.childId === childId) ?? { offered: 0, completed: 0 };

  return [
    {
      key: "name",
      header: "שם",
      size: "grow",
      mobile: "title",
      cell: (child) => (
        <Link
          href={`/app/students/${child.id}` as Route}
          className="text-primary hover:underline"
        >
          {child.firstName} {child.lastName}
        </Link>
      ),
    },
    {
      key: "gender",
      header: "מגדר",
      size: "min",
      cell: (child) => (child.gender === "male" ? "זכר" : "נקבה"),
    },
    {
      key: "age",
      header: "גיל",
      size: "min",
      cell: (child) => calculateAge(new Date(child.birthDate)),
    },
    { key: "city", header: "עיר", cell: (child) => child.city },
    {
      key: "offered",
      header: "שידוכים הוצעו",
      size: "min",
      align: "center",
      cell: (child) => statsFor(child.id).offered,
    },
    {
      key: "completed",
      header: "שידוכים נסגרו",
      size: "min",
      align: "center",
      cell: (child) => statsFor(child.id).completed,
    },
  ];
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

async function UserDetailsContent({ params }: UserDetailsPageProps) {
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
      <Page>
        <PageHeader
          title="שגיאה"
          description="אירעה שגיאה בטעינת פרטי המשתמש"
          actions={
            <Button asChild variant="outline">
              <Link href="/app/admin/users">חזרה לרשימת המשתמשים</Link>
            </Button>
          }
        />
        <div className="rounded-lg border border-destructive bg-destructive/10 p-6">
          <h3 className="mb-2 text-subtitle font-semibold text-destructive">
            שגיאה בהגדרת האדמין
          </h3>
          {isServiceRoleKeyError ? (
            <div className="space-y-4">
              <p className="text-body-sm">
                המשתנה{" "}
                <code className="rounded bg-muted px-2 py-1">
                  SUPABASE_SERVICE_ROLE_KEY
                </code>{" "}
                לא מוגדר.
              </p>
              <div className="space-y-2 rounded-lg bg-muted p-4">
                <p className="font-semibold">הוראות התקנה:</p>
                <ol className="list-inside list-decimal space-y-1 text-body-sm">
                  <li>
                    פתח את קובץ{" "}
                    <code className="rounded bg-background px-1">
                      .env.local
                    </code>{" "}
                    בתיקיית הפרויקט
                  </li>
                  <li>
                    הוסף את השורה:{" "}
                    <code className="rounded bg-background px-1">
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
                    <code className="rounded bg-background px-1">
                      npm run dev
                    </code>
                    )
                  </li>
                </ol>
              </div>
              <p className="text-caption text-muted-foreground">
                ⚠️ ה-Service Role Key רגיש מאוד - אל תחלוק אותו או תעלה אותו
                ל-Git
              </p>
            </div>
          ) : (
            <p className="text-body-sm">{error.message}</p>
          )}
        </div>
      </Page>
    );
  }

  if (!userDetails) {
    notFound();
  }

  return (
    <Page>
      <PageHeader
        title={`פרטי משתמש: ${userDetails.firstName} ${userDetails.lastName}`}
        description="מידע מפורט על המשתמש"
        actions={
          <Button asChild variant="outline">
            <Link href="/app/admin/users">חזרה לרשימת המשתמשים</Link>
          </Button>
        }
      />
      <div className="space-y-6">
        {/* מידע בסיסי */}
        <Card>
          <CardHeader>
            <CardTitle asChild>
              <h2>מידע בסיסי</h2>
            </CardTitle>
          </CardHeader>
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
              <span className="text-muted-foreground">
                {userDetails.roles.length > 1 ? "תפקידים:" : "תפקיד:"}
              </span>{" "}
              {userDetails.roles.map(getRoleLabel).join(" · ")}
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
        </Card>

        {/* עריכת תפקידים - משתמש יכול להיות גם וגם (למשל שדכן וגם איש צוות) */}
        <Card>
          <CardHeader>
            <CardTitle asChild>
              <h2>תפקידים</h2>
            </CardTitle>
          </CardHeader>
          <UserRolesEditor
            userId={userDetails.id}
            initialRoles={userDetails.roles}
            initialInstitutionId={userDetails.staffInstitutionId}
          />
        </Card>

        {/* סטטיסטיקות שידוכים */}
        <Card>
          <CardHeader>
            <CardTitle asChild>
              <h2>סטטיסטיקות שידוכים</h2>
            </CardTitle>
          </CardHeader>
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
        </Card>

        {/* ילדים */}
        <Card>
          <CardHeader>
            <CardTitle asChild>
              <h2>ילדים במערכת ({userDetails.children.length})</h2>
            </CardTitle>
          </CardHeader>
          <DataTable
            surface={false}
            caption="ילדים במערכת"
            columns={childColumns(userDetails.shidduchimStats.byChild)}
            rows={userDetails.children}
            getRowKey={(child) => child.id}
            emptyState={
              <Empty size="compact" surface={false}>
                <EmptyHeader>
                  <EmptyTitle>אין ילדים רשומים במערכת</EmptyTitle>
                </EmptyHeader>
              </Empty>
            }
          />
        </Card>
      </div>
    </Page>
  );
}

function UserDetailsFallback() {
  return (
    <Page>
      <PageHeader
        title="פרטי משתמש"
        description="מידע מפורט על המשתמש"
        actions={
          <Button asChild variant="outline">
            <Link href="/app/admin/users">חזרה לרשימת המשתמשים</Link>
          </Button>
        }
      />
      <SkeletonRegion className="space-y-6">
        {Array.from({ length: FALLBACK_SECTION_COUNT }).map((_, index) => (
          <CardSkeleton key={index} header={false}>
            <Skeleton className="h-6 w-40" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
            </div>
          </CardSkeleton>
        ))}
      </SkeletonRegion>
    </Page>
  );
}

export default function UserDetailsPage(props: UserDetailsPageProps) {
  return (
    <Suspense fallback={<UserDetailsFallback />}>
      <UserDetailsContent {...props} />
    </Suspense>
  );
}
