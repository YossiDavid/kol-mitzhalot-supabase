import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DashboardSection } from "@/components/layout";
import { Users, FileText, UserCheck } from "lucide-react";

export default function AdminPage() {
  return (
    <div className="space-y-10 py-4">
      <DashboardSection
        title="ניהול מערכת"
        subTitle="דף הבית של מנהל המערכת"
        button={<Button disabled>דף הבית</Button>}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          <Link href="/app/admin/shadchanim">
            <div className="p-6 border rounded-lg hover:bg-accent transition-colors cursor-pointer">
              <UserCheck className="h-8 w-8 mb-4" />
              <h3 className="text-lg font-semibold mb-2">כל השדכנים</h3>
              <p className="text-sm text-muted-foreground">
                ניהול וצפייה בכל השדכנים במערכת
              </p>
            </div>
          </Link>

          <Link href="/app/admin/users">
            <div className="p-6 border rounded-lg hover:bg-accent transition-colors cursor-pointer">
              <Users className="h-8 w-8 mb-4" />
              <h3 className="text-lg font-semibold mb-2">כל המשתמשים</h3>
              <p className="text-sm text-muted-foreground">
                ניהול וצפייה בכל המשתמשים במערכת
              </p>
            </div>
          </Link>

          <Link href="/app/admin/settings">
            <div className="p-6 border rounded-lg hover:bg-accent transition-colors cursor-pointer">
              <FileText className="h-8 w-8 mb-4" />
              <h3 className="text-lg font-semibold mb-2">הגדרות מערכת</h3>
              <p className="text-sm text-muted-foreground">
                עריכת תוכן מערכת כמו מדיניות פרטיות
              </p>
            </div>
          </Link>
        </div>
      </DashboardSection>
    </div>
  );
}
