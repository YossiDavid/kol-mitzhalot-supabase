import type { Route } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";

import { getShadchanAccess } from "@/features/shadchanim/lib/shadchan-access";
import { getUser, hasRole } from "@/lib/user";

const SHADCHAN_FROZEN_PATH = "/app/shadchan/frozen" as Route;

/**
 * לוח ההתאמות פתוח לשדכן ולמנהל בלבד. השער אינו מציג דבר, ולכן הוא זורם
 * אחרי המסגרת במקום לעכב את הרינדור שלה.
 */
async function CanvasGate() {
  const user = await getUser();

  if (!user) {
    redirect("/auth/login");
  }

  if (hasRole(user, "admin")) return null;

  const shadchanAccess = await getShadchanAccess(user);
  // שדכן מוקפא: הסבר במקום הפניה שקטה לעמוד הראשי
  if (shadchanAccess === "frozen") redirect(SHADCHAN_FROZEN_PATH);
  if (shadchanAccess === "none") redirect("/app");

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
