"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { PhotoRequestStatus } from "@/features/photo-requests/lib/photo-request-status";

interface PhotoRequestActionsProps {
  requestId: string;
}

/**
 * אישור/דחייה של בקשת צפייה בתמונה.
 *
 * העדכון נשלח ישירות מהדפדפן ולא דרך route שרת, כי מדיניות ה-RLS על
 * photo_view_requests כבר מגבילה UPDATE למנהל בלבד — route שרת היה מוסיף
 * שכבת הרשאה שנייה שצריך לתחזק במקביל לאותו כלל.
 *
 * decided_by/decided_at לא נשלחים כאן במכוון: טריגר
 * stamp_photo_view_request_decision חותם אותם בשרת, כדי שרישום הביקורת
 * לא יהיה ניתן לזיוף מהלקוח ולא ייעלם אם נשכח לשלוח אותו.
 */
export function PhotoRequestActions({ requestId }: PhotoRequestActionsProps) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<PhotoRequestStatus | null>(
    null,
  );

  async function decide(status: "approved" | "rejected") {
    const confirmMessage =
      status === "approved"
        ? "לאשר את הבקשה? התמונה תיחשף למבקש."
        : "לדחות את הבקשה?";
    if (!confirm(confirmMessage)) return;

    setPendingAction(status);
    const supabase = createClient();
    const { error } = await supabase
      .from("photo_view_requests")
      .update({ status })
      .eq("id", requestId);

    if (error) {
      console.error("[photo-requests] decide", error);
      toast.error(`שגיאה בעדכון הבקשה: ${error.message}`);
      setPendingAction(null);
      return;
    }

    toast.success(status === "approved" ? "הבקשה אושרה" : "הבקשה נדחתה");
    setPendingAction(null);
    router.refresh();
  }

  const isBusy = pendingAction !== null;

  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        size="sm"
        onClick={() => decide("approved")}
        disabled={isBusy}
        variant="default"
      >
        {pendingAction === "approved" ? "מאשר..." : "אישור"}
      </Button>
      <Button
        size="sm"
        onClick={() => decide("rejected")}
        disabled={isBusy}
        variant="destructive"
      >
        {pendingAction === "rejected" ? "דוחה..." : "דחייה"}
      </Button>
    </div>
  );
}
