import { IdleLogoutForm } from "@/features/idle-logout/components/idle-logout-form";
import { getIdleLogoutMinutes } from "@/features/idle-logout/lib/idle-logout-setting";

/**
 * ההגדרה בעמוד ההגדרות של המנהל. הקריאה תלויה בסשן (cookies) ולכן דינמית,
 * ונמצאת מאחורי Suspense בדף. אין שורה = ברירת המחדל (30 דקות).
 */
export async function IdleLogoutSetting() {
  const minutes = await getIdleLogoutMinutes();
  return <IdleLogoutForm initialMinutes={minutes} />;
}
