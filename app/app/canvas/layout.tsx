import { Suspense } from "react";
import { redirect } from "next/navigation";

import { getUser, hasRole } from "@/lib/user";

/**
 * לוח ההתאמות פתוח לשדכן ולמנהל בלבד. השער אינו מציג דבר, ולכן הוא זורם
 * אחרי המסגרת במקום לעכב את הרינדור שלה.
 */
async function CanvasGate() {
  const user = await getUser();

  if (!user) {
    redirect("/auth/login");
  }

  if (!hasRole(user, "admin") && !hasRole(user, "shadchan")) {
    redirect("/app");
  }

  return null;
}

export default function CanvasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Suspense fallback={null}>
        <CanvasGate />
      </Suspense>
      {children}
    </>
  );
}
