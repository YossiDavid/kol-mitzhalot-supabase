import { Button } from "@/components/ui/button";
import { LinkCard, Page, PageHeader } from "@/components/layout";
import {
  BookOpen,
  FileText,
  GraduationCap,
  Image as ImageIcon,
  Link2,
  UserCheck,
  UserPlus,
  Users,
  UsersRound,
} from "lucide-react";

export default function AdminPage() {
  return (
    <Page>
      <PageHeader
        title="ניהול מערכת"
        description="דף הבית של מנהל המערכת"
        actions={<Button disabled>דף הבית</Button>}
      />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <LinkCard
          href="/app/admin/shadchanim"
          icon={UserCheck}
          title="כל השדכנים"
          description="ניהול וצפייה בכל השדכנים במערכת"
        />
        <LinkCard
          href="/app/admin/staff/requests"
          icon={UserPlus}
          title="בקשות הצטרפות כאיש צוות"
          description="אישור ודחייה של בקשות הצטרפות כאיש צוות"
        />
        <LinkCard
          href="/app/admin/photo-requests"
          icon={ImageIcon}
          title="בקשות צפייה בתמונה"
          description="אישור ודחייה של בקשות שדכנים לצפות בתמונת מיועדת"
        />
        <LinkCard
          href="/app/admin/users"
          icon={Users}
          title="כל המשתמשים"
          description="ניהול וצפייה בכל המשתמשים במערכת"
        />
        <LinkCard
          href="/app/admin/settings"
          icon={FileText}
          title="הגדרות מערכת"
          description="עריכת תוכן מערכת כמו מדיניות פרטיות"
        />
        <LinkCard
          href="/app/admin/content"
          icon={BookOpen}
          title="ניהול תוכן"
          description="מאמרים, מאורסים, והמלצות רבנים"
        />
        <LinkCard
          href="/app/admin/institutions"
          icon={GraduationCap}
          title="מוסדות לימוד"
          description="ניהול מאגר מוסדות הלימוד לבחירה באשף יצירת כרטיס מיועד"
        />
        <LinkCard
          href="/app/admin/communities"
          icon={UsersRound}
          title="חסידויות וקהילות"
          description="ניהול מאגר החסידויות והקהילות לבחירה באשף יצירת כרטיס מיועד"
        />
        <LinkCard
          href="/app/admin/students/institutions"
          icon={Link2}
          title="שיוך מוסד המוני"
          description="שיוך מוסד לימודים למספר כרטיסי מיועדים בבת אחת"
        />
      </div>
    </Page>
  );
}
