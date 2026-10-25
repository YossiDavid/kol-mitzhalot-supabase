import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ImpersonationBanner } from "@/features/admin/components/impersonation-banner";
import { SystemAnnouncementBanner } from "@/features/announcements/components/system-announcement-banner";

import { cn } from "@/lib/utils";
import { cookies, headers } from "next/headers";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Toaster } from "@/components/ui/sonner";
import { redirect } from "next/navigation";
import { withNextParam } from "@/features/auth/lib/next-path";
import { getRoles, getUser } from "@/lib/user";
import { readSignupPurpose } from "@/features/auth/lib/signup-purpose";
import { getPhoneVerificationEnabled } from "@/lib/system-settings";
import { UnreadChatsProvider } from "@/features/chats/lib/unread-chats-context";
import Analytics from "@/components/website/google-analytics";
import { TermsGateDialog } from "@/features/auth/components/terms-gate-dialog";
import { resolveTermsGate } from "@/features/auth/lib/terms-gate";
import { ShidduchCelebration } from "@/features/engagements/components/shidduch-celebration";
import { IdleLogoutGuard } from "@/features/idle-logout/components/idle-logout-guard";
import { getIdleLogoutMinutes } from "@/features/idle-logout/lib/idle-logout-setting";

// כרטיס מיועד ציבורי: נתיב של בדיוק /app/students/<מזהה> ללא סגמנטים נוספים.
// ה-lookahead השלילי מוציא במפורש את /app/students/create, כדי שדף יצירת
// מיועד ימשיך לדרוש התחברות למרות שגם לו יש סגמנט יחיד אחרי /app/students.
// /app/students (בלי סגמנט) לא תואם בכלל, ולכן גם הוא ממשיך לדרוש התחברות.
const PUBLIC_STUDENT_CARD_PATH_REGEX = /^\/app\/students\/(?!create$)[^/]+$/;

// המעטפת נטענת לכל בקשה: היא תלויה בסשן, בתפקידים ובעוגיית מצב הסיידבר.
// היא נשארת חוסמת בכוונה — הדר וסיידבר שמוזרמים מאחורי שלד "קופצים"
// בטעינה. השלד נשאר ברמת הדף, כך שרק התוכן מתחלף משלד לתוכן.
export const instant = false;

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

  // הגדרת אימות הטלפון לא תלויה במשתמש, ולכן יוצאת במקביל ל-getUser ולא
  // אחריו. היא לא נזרקת (תופסת שגיאות בעצמה), ונצרכת רק למשתמש מחובר.
  const phoneVerificationPromise = getPhoneVerificationEnabled();
  // כך גם זמן ההתנתקות האוטומטית (לא נזרק; כשל = ברירת המחדל)
  const idleLogoutMinutesPromise = getIdleLogoutMinutes();
  const user = await getUser();

  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-pathname") ?? "";
  const isPublicStudentCard = PUBLIC_STUDENT_CARD_PATH_REGEX.test(pathname);

  // הכתובת שאליה המשתמש ניסה להגיע. נשמרת בכל הפניה שמוציאה אותו מכאן, כדי
  // שקישור עמוק ממייל (הצעת שידוך, למשל) לא יאבד בדרך להתחברות או לאימות.
  const requestedPath = `${pathname}${requestHeaders.get("x-search") ?? ""}`;

  // בדיקת אימות - אם המשתמש לא מחובר, הפנה להתחברות, חוץ מכרטיס מיועד
  // ציבורי (הגבלת המידע הנחשף למשתמש לא מחובר נעשית בתוך הדף עצמו).
  if (!user && !isPublicStudentCard) {
    redirect(withNextParam("/auth/login", requestedPath));
  }

  // בדיקת אימות טלפון רלוונטית רק למשתמש מחובר - משתמש לא מחובר שצופה
  // בכרטיס מיועד ציבורי מדלג עליה לגמרי.
  if (user) {
    const phoneVerificationEnabled = await phoneVerificationPromise;
    if (phoneVerificationEnabled) {
      const isPhoneVerified = user.user_metadata?.phone_verified === true;
      if (!isPhoneVerified) {
        redirect(withNextParam("/auth/verify-phone", requestedPath));
      }
    }
  }

  // אישור התקנון: עד שהמשתמש מאשר את הגרסה הנוכחית, כל דפי /app מוחלפים
  // בדיאלוג חוסם. בקשה רגילה עולה שאילתה אחת קטנה (ממוזכרת לבקשה).
  const termsGate = user ? await resolveTermsGate(user) : null;

  const roles = user ? getRoles(user) : [];
  const idleLogoutMinutes = user ? await idleLogoutMinutesPromise : 0;

  // גולש לא מחובר בכרטיס ציבורי מקבל מעטפת מינימלית: אין sidebar, אין
  // ניווט תחתון ואין באנר התחזות — כולם כלי ניהול של משתמש מחובר.
  // חובה variant="website": וריאנט "app" מרנדר SidebarTrigger שקורא
  // ל-useSidebar, ומחוץ ל-SidebarProvider הוא זורק שגיאה בצד הלקוח.
  if (!user && isPublicStudentCard) {
    return (
      <div className="flex min-h-svh flex-col">
        <Header variant="website" />
        <main className="container flex-1 px-3 py-4 md:px-4 md:py-5">
          {children}
        </main>
        <Footer withToaster />
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      {/* ספירת הצ'אטים שלא נקראו משותפת לסיידבר ולסרגל התחתון — ערוץ אחד */}
      <UnreadChatsProvider userId={user?.id ?? null}>
        <AppSidebar
          roles={roles}
          highlightShadchanJoin={
            !!user && readSignupPurpose(user) === "shadchan"
          }
          highlightStaffJoin={!!user && readSignupPurpose(user) === "staff"}
        />
        <SidebarInset>
          <ImpersonationBanner />
          <div className="flex flex-1 flex-col">
            <Header variant="app" />
            {/* 5.5rem = גובה הסרגל התחתון (4rem) + רווח, מעל ה-safe-area */}
            <main className="container flex-1 px-3 py-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:px-4 md:py-5 md:pb-5">
              {termsGate ? (
                <TermsGateDialog
                  version={termsGate.version}
                  title={termsGate.title}
                  content={termsGate.content}
                />
              ) : (
                <>
                  {user && (
                    <SystemAnnouncementBanner
                      userId={user.id}
                      isAdmin={roles.includes("admin")}
                    />
                  )}
                  {children}
                </>
              )}
            </main>
            {/* חגיגת שידוכים - לא מעל דיאלוג התקנון החוסם */}
            {user && !termsGate && <ShidduchCelebration />}
            {/* התנתקות אוטומטית אחרי חוסר פעילות (0 = כבוי בהגדרות המנהל) */}
            {user && idleLogoutMinutes > 0 && (
              <IdleLogoutGuard timeoutMinutes={idleLogoutMinutes} />
            )}
            <Footer className="hidden md:block" />
          </div>
          <BottomNav roles={roles} />
          <Toaster
            richColors
            dir="rtl"
            position="top-center"
            style={{
              fontFamily: "ploni",
            }}
            className={cn(
              "**:data-title:text-subtitle **:data-title:font-black!",
              "**:data-description:text-body-sm",
            )}
          />
        </SidebarInset>
      </UnreadChatsProvider>
    </SidebarProvider>
  );
}
