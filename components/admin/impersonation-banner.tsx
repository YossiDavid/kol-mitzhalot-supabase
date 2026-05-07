"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ADMIN_IMPERSONATION_BACKUP_KEY } from "@/lib/impersonation";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function ImpersonationBanner() {
  const [show, setShow] = useState(false);
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const backup = sessionStorage.getItem(ADMIN_IMPERSONATION_BACKUP_KEY);
    if (!backup) {
      setShow(false);
      return;
    }
    setShow(true);
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      const first = user?.user_metadata?.firstName ?? "";
      const last = user?.user_metadata?.lastName ?? "";
      setUserName(([first, last].filter(Boolean).join(" ") || user?.email) ?? "משתמש");
    });
  }, []);

  const handleReturnToAdmin = async () => {
    const raw = sessionStorage.getItem(ADMIN_IMPERSONATION_BACKUP_KEY);
    if (!raw) {
      setShow(false);
      window.location.href = "/app";
      return;
    }
    try {
      const { access_token, refresh_token } = JSON.parse(raw) as {
        access_token: string;
        refresh_token: string;
      };
      const supabase = createClient();
      const { error } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });
      sessionStorage.removeItem(ADMIN_IMPERSONATION_BACKUP_KEY);
      if (error) {
        console.error("Failed to restore admin session:", error);
        window.location.href = "/auth/login";
        return;
      }
      window.location.href = "/app";
    } catch {
      sessionStorage.removeItem(ADMIN_IMPERSONATION_BACKUP_KEY);
      window.location.href = "/auth/login";
    }
  };

  if (!show) return null;

  return (
    <div
      role="banner"
      className="bg-amber-500/15 text-amber-900 dark:text-amber-100 border-b border-amber-500/30 px-4 py-2 flex flex-wrap items-center justify-center gap-3"
    >
      <span>
        אתה צופה כמשתמש <strong>{userName}</strong>
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleReturnToAdmin}
        className="gap-1.5 border-amber-600 text-amber-800 dark:border-amber-400 dark:text-amber-200 hover:bg-amber-500/20"
      >
        <LogOut className="h-4 w-4" />
        חזרה למנהל
      </Button>
    </div>
  );
}
