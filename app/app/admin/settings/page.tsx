import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LinkCard, Page, PageHeader } from "@/components/layout";
import { Shield, FileCheck, Accessibility } from "lucide-react";
import { PhoneVerificationToggle } from "@/features/admin/components/phone-verification-toggle";

export default function SettingsPage() {
  return (
    <Page>
      <PageHeader
        title="הגדרות מערכת"
        description="עריכת תוכן מערכת"
        actions={
          <Button asChild>
            <Link href="/app/admin">חזרה לדף הבית</Link>
          </Button>
        }
      />
      <PhoneVerificationToggle />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <LinkCard
          href="/app/admin/settings/privacy-policy"
          icon={Shield}
          title="מדיניות פרטיות"
          description="עריכת מדיניות הפרטיות של המערכת"
        />
        <LinkCard
          href="/app/admin/settings/terms-of-service"
          icon={FileCheck}
          title="תנאי שימוש"
          description="עריכת תנאי השימוש של המערכת"
        />
        <LinkCard
          href="/app/admin/settings/accessibility"
          icon={Accessibility}
          title="הצהרת נגישות"
          description="עריכת הצהרת הנגישות של המערכת"
        />
      </div>
    </Page>
  );
}
