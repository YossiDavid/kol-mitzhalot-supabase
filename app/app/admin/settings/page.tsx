import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DashboardSection } from "@/components/layout";
import { Shield, FileCheck, Accessibility } from "lucide-react";
import { PhoneVerificationToggle } from "@/components/admin/phone-verification-toggle";

export default function SettingsPage() {
  return (
    <div className="space-y-10 py-4">
      <DashboardSection
        title="הגדרות מערכת"
        subTitle="עריכת תוכן מערכת"
        button={<Button asChild><Link href="/app/admin">חזרה לדף הבית</Link></Button>}
      >
        <div className="mt-6 space-y-6">
          <PhoneVerificationToggle />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
          <Link href="/app/admin/settings/privacy-policy">
            <div className="p-6 border rounded-lg hover:bg-accent transition-colors cursor-pointer">
              <Shield className="h-8 w-8 mb-4" />
              <h3 className="text-lg font-semibold mb-2">מדיניות פרטיות</h3>
              <p className="text-sm text-muted-foreground">
                עריכת מדיניות הפרטיות של המערכת
              </p>
            </div>
          </Link>

          <Link href="/app/admin/settings/terms-of-service">
            <div className="p-6 border rounded-lg hover:bg-accent transition-colors cursor-pointer">
              <FileCheck className="h-8 w-8 mb-4" />
              <h3 className="text-lg font-semibold mb-2">תנאי שימוש</h3>
              <p className="text-sm text-muted-foreground">
                עריכת תנאי השימוש של המערכת
              </p>
            </div>
          </Link>

          <Link href="/app/admin/settings/accessibility">
            <div className="p-6 border rounded-lg hover:bg-accent transition-colors cursor-pointer">
              <Accessibility className="h-8 w-8 mb-4" />
              <h3 className="text-lg font-semibold mb-2">הצהרת נגישות</h3>
              <p className="text-sm text-muted-foreground">
                עריכת הצהרת הנגישות של המערכת
              </p>
            </div>
          </Link>
        </div>
      </DashboardSection>
    </div>
  );
}
