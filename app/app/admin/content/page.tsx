import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LinkCard, Page, PageHeader } from "@/components/layout";
import { FileText, Heart, Star, Inbox, Mail } from "lucide-react";

// Callers: admin dashboard. User: "1. להוסיף אזורים במערכת הניהול" + forms inbox links.

export default function ContentHubPage() {
  return (
    <Page>
      <PageHeader
        title="ניהול תוכן"
        description="מאמרים, מאורסים, המלצות רבנים ופניות מהאתר"
        actions={
          <Button asChild variant="outline">
            <Link href="/app/admin">חזרה לדשבורד</Link>
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <LinkCard
          href="/app/admin/content/articles"
          icon={FileText}
          title="מאמרים"
          description="יצירה, עריכה ופרסום מאמרים לכל קטגוריה"
        />
        <LinkCard
          href="/app/admin/content/engagements"
          icon={Heart}
          title="מודעות מאורסים"
          description="אישור ופרסום מודעות שידוכים שנסגרו"
        />
        <LinkCard
          href="/app/admin/content/endorsements"
          icon={Star}
          title="המלצות רבנים"
          description="ניהול הסכמות ומלצות רבני הקהילה"
        />
        <LinkCard
          href="/app/admin/content/submissions"
          icon={Inbox}
          title="פניות מהאתר"
          description="צור קשר ורעיונות לשידוך מהטפסים הציבוריים"
        />
        <LinkCard
          href="/app/admin/content/newsletter"
          icon={Mail}
          title="רשימת תפוצה"
          description="נרשמים מהפוטר עד חיבור למסוף ניוזלטרים"
        />
      </div>
    </Page>
  );
}
