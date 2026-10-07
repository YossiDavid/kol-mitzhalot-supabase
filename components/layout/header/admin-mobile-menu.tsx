"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";

import { isAdminPath } from "@/components/sidebar/admin-nav-items";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";

/**
 * במובייל הסיידבר מוסתר; בתוך /app/admin הכפתור הזה פותח את תפריט הניהול
 * כ-Sheet (אותם נתונים כמו בדסקטופ). מוצג רק למנהל, בהדר.
 */
export function AdminMobileMenuTrigger() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  if (!isAdminPath(pathname)) return null;

  return (
    <Button
      variant="ghost"
      size="icon"
      className="md:hidden"
      aria-label="תפריט ניהול"
      data-testid="admin-mobile-menu-trigger"
      onClick={() => setOpenMobile(true)}
    >
      <Menu aria-hidden />
    </Button>
  );
}
