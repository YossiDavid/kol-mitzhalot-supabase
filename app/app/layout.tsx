import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ImpersonationBanner } from "@/components/admin/impersonation-banner";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { Suspense } from "react";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Toaster } from "@/components/ui/sonner";
import { redirect } from "next/navigation";
import { getEffectiveRole } from "@/lib/user";
import { getPhoneVerificationEnabled } from "@/lib/system-settings";

async function SidebarLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // בדיקת אימות - אם המשתמש לא מחובר, הפנה להתחברות
  if (!user) {
    redirect("/auth/login");
  }

  const phoneVerificationEnabled = await getPhoneVerificationEnabled();

  if (phoneVerificationEnabled) {
    const isPhoneVerified = user?.user_metadata?.phone_verified === true;
    if (!isPhoneVerified) {
      redirect("/auth/verify-phone");
    }
  }

  const role = getEffectiveRole(user);

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar role={role} />
      <SidebarInset>
        <ImpersonationBanner />
        <div className="flex flex-1 flex-col">
          <Header variant="app" />
          <main className="container flex-1 px-3 py-4 pb-24 md:px-4 md:py-5 md:pb-5">{children}</main>
          <Footer className="hidden md:block" />
        </div>
        <BottomNav role={role} />
        <Toaster
          richColors
          dir="rtl"
          position="top-center"
          style={{
            fontFamily: "ploni",
          }}
          className={cn(
            "**:data-title:text-lg **:data-title:font-black!",
            "**:data-description:text-sm",
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
