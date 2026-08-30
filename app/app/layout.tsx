import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ImpersonationBanner } from "@/features/admin/components/impersonation-banner";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { cookies, headers } from "next/headers";
import { Suspense } from "react";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Toaster } from "@/components/ui/sonner";
import { redirect } from "next/navigation";
import { getRoles } from "@/lib/user";
import { getPhoneVerificationEnabled } from "@/lib/system-settings";

// כרטיס מיועד ציבורי: נתיב של בדיוק /app/students/<מזהה> ללא סגמנטים נוספים.
// ה-lookahead השלילי מוציא במפורש את /app/students/create, כדי שדף יצירת
// מיועד ימשיך לדרוש התחברות למרות שגם לו יש סגמנט יחיד אחרי /app/students.
// /app/students (בלי סגמנט) לא תואם בכלל, ולכן גם הוא ממשיך לדרוש התחברות.
const PUBLIC_STUDENT_CARD_PATH_REGEX = /^\/app\/students\/(?!create$)[^/]+$/;

async function SidebarLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = (await headers()).get("x-pathname") ?? "";
  const isPublicStudentCard = PUBLIC_STUDENT_CARD_PATH_REGEX.test(pathname);

  // בדיקת אימות - אם המשתמש לא מחובר, הפנה להתחברות, חוץ מכרטיס מיועד
  // ציבורי (הגבלת המידע הנחשף למשתמש לא מחובר נעשית בתוך הדף עצמו).
  if (!user && !isPublicStudentCard) {
    redirect("/auth/login");
  }

  // בדיקת אימות טלפון רלוונטית רק למשתמש מחובר - משתמש לא מחובר שצופה
  // בכרטיס מיועד ציבורי מדלג עליה לגמרי.
  if (user) {
    const phoneVerificationEnabled = await getPhoneVerificationEnabled();
    if (phoneVerificationEnabled) {
      const isPhoneVerified = user.user_metadata?.phone_verified === true;
      if (!isPhoneVerified) {
        redirect("/auth/verify-phone");
      }
    }
  }

  const roles = user ? getRoles(user) : [];

  // גולש לא מחובר בכרטיס ציבורי מקבל מעטפת מינימלית: אין sidebar, אין
  // ניווט תחתון ואין באנר התחזות — כולם כלי ניהול של משתמש מחובר.
  if (!user && isPublicStudentCard) {
    return (
      <div className="flex min-h-svh flex-col">
        <Header variant="app" />
        <main className="container flex-1 px-3 py-4 md:px-4 md:py-5">
          {children}
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar roles={roles} />
      <SidebarInset>
        <ImpersonationBanner />
        <div className="flex flex-1 flex-col">
          <Header variant="app" />
          <main className="container flex-1 px-3 py-4 pb-24 md:px-4 md:py-5 md:pb-5">
            {children}
          </main>
          <Footer className="hidden md:flex" />
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
    </SidebarProvider>
  );
}

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <Suspense fallback={null}>
      <SidebarLayout>{children}</SidebarLayout>
    </Suspense>
  );
}
