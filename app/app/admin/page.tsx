import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DashboardSection } from "@/components/layout";
import { Users, FileText, UserCheck, BookOpen, UserPlus } from "lucide-react";

export default function AdminPage() {
  return (
    <div className="space-y-10 py-4">
      <DashboardSection
        title="ניהול מערכת"
        subTitle="דף הבית של מנהל המערכת"
        button={<Button disabled>דף הבית</Button>}
      >
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
          <Link href="/app/admin/shadchanim">
            <div className="cursor-pointer rounded-lg border p-6 transition-colors hover:bg-accent">
              <UserCheck className="mb-4 h-8 w-8" />
              <h3 className="mb-2 text-subtitle font-semibold">כל השדכנים</h3>
              <p className="text-body-sm text-muted-foreground">
                ניהול וצפייה בכל השדכנים במערכת
              </p>
            </div>
          </Link>

          <Link href="/app/admin/staff/requests">
            <div className="cursor-pointer rounded-lg border p-6 transition-colors hover:bg-accent">
              <UserPlus className="mb-4 h-8 w-8" />
              <h3 className="mb-2 text-subtitle font-semibold">
                בקשות הצטרפות כאיש צוות
              </h3>
              <p className="text-body-sm text-muted-foreground">
                אישור ודחייה של בקשות הצטרפות כאיש צוות
              </p>
            </div>
          </Link>

          <Link href="/app/admin/users">
            <div className="cursor-pointer rounded-lg border p-6 transition-colors hover:bg-accent">
              <Users className="mb-4 h-8 w-8" />
              <h3 className="mb-2 text-subtitle font-semibold">כל המשתמשים</h3>
              <p className="text-body-sm text-muted-foreground">
                ניהול וצפייה בכל המשתמשים במערכת
              </p>
            </div>
          </Link>

          <Link href="/app/admin/settings">
            <div className="cursor-pointer rounded-lg border p-6 transition-colors hover:bg-accent">
              <FileText className="mb-4 h-8 w-8" />
              <h3 className="mb-2 text-subtitle font-semibold">הגדרות מערכת</h3>
              <p className="text-body-sm text-muted-foreground">
                עריכת תוכן מערכת כמו מדיניות פרטיות
              </p>
            </div>
          </Link>

          <Link href={"/app/admin/content" as any}>
            <div className="cursor-pointer rounded-lg border p-6 transition-colors hover:bg-accent">
              <BookOpen className="mb-4 h-8 w-8" />
              <h3 className="mb-2 text-subtitle font-semibold">ניהול תוכן</h3>
              <p className="text-body-sm text-muted-foreground">
                מאמרים, מאורסים, והמלצות רבנים
              </p>
            </div>
          </Link>
        </div>
      </DashboardSection>
    </div>
  );
}
