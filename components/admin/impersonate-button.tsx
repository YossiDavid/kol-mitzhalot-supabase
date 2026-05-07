"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LogIn } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { ADMIN_IMPERSONATION_BACKUP_KEY } from "@/lib/impersonation";

export function ImpersonateButton({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(false);

  const handleImpersonate = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token && session?.refresh_token) {
        sessionStorage.setItem(
          ADMIN_IMPERSONATION_BACKUP_KEY,
          JSON.stringify({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          }),
        );
      }

      const res = await fetch("/api/v1/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "שגיאה בהתחברות כמשתמש");
        sessionStorage.removeItem(ADMIN_IMPERSONATION_BACKUP_KEY);
        return;
      }

      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        toast.error("לא התקבל קישור להתחברות");
        sessionStorage.removeItem(ADMIN_IMPERSONATION_BACKUP_KEY);
      }
    } catch {
      toast.error("שגיאה בהתחברות כמשתמש");
      sessionStorage.removeItem(ADMIN_IMPERSONATION_BACKUP_KEY);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleImpersonate}
      disabled={loading}
      className="gap-1"
    >
      <LogIn className="h-3.5 w-3.5" />
      {loading ? "מתחבר..." : "התחבר כמשתמש"}
    </Button>
  );
}
