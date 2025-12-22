import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { Suspense } from "react";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { Toaster } from "@/components/ui/sonner";
import { redirect } from "next/navigation";

async function SidebarLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // בדיקה האם המשתמש מאומת טלפונית
  const isPhoneVerified = user?.user_metadata?.phone_verified === true;

  if (!isPhoneVerified) {
    // כאן אתה מעביר אותו לדף "נא אמת את הטלפון שלך"
    // או חוסם לו את הגישה לתפריטים ב-UI
    redirect("/auth/verify-phone");
  }

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar />
      <SidebarInset>
        <div className="flex flex-1 flex-col">
          <Header />
          <main className="container flex-1 py-5">{children}</main>
          <Footer />
        </div>
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
