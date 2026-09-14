import { Suspense } from "react";
import { redirect } from "next/navigation";

import { getUser, hasRole } from "@/lib/user";

/**
 * בדיקת הרשאת הניהול. אינה מציגה דבר, ולכן היא זורמת אחרי המסגרת במקום
 * לעכב את הרינדור של כל /app/admin. המידע עצמו מוגן ב-RLS ובבדיקות
 * שבצד השרת, וכאן מדובר בשער ניווט בלבד.
 */
async function AdminGate() {
  const user = await getUser();

  if (!hasRole(user, "admin")) {
    redirect("/app");
  }

  return null;
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Suspense fallback={null}>
        <AdminGate />
      </Suspense>
      {children}
    </>
  );
}
