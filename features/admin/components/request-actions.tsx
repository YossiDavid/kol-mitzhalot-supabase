"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface ShadchanRequestActionsProps {
  requestId: string;
}

export function ShadchanRequestActions({ requestId }: ShadchanRequestActionsProps) {
  const router = useRouter();
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  const handleApprove = async () => {
    if (!confirm("האם אתה בטוח שברצונך לאשר בקשה זו?")) {
      return;
    }

    setIsApproving(true);
    try {
      const response = await fetch("/api/v1/admin/shadchanim/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: requestId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "אירעה שגיאה באישור הבקשה");
      }

      toast.success("הבקשה אושרה בהצלחה");
      router.refresh();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "אירעה שגיאה באישור הבקשה";
      toast.error(errorMessage);
      console.error("Error approving request:", error);
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    const reason = prompt("אנא הזן סיבת דחייה:");
    if (reason === null) {
      return; // המשתמש ביטל
    }

    setIsRejecting(true);
    try {
      const response = await fetch("/api/v1/admin/shadchanim/reject", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: requestId, reason: reason || "" }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "אירעה שגיאה בדחיית הבקשה");
      }

      toast.success("הבקשה נדחתה");
      router.refresh();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "אירעה שגיאה בדחיית הבקשה";
      toast.error(errorMessage);
      console.error("Error rejecting request:", error);
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Button
        onClick={handleApprove}
        disabled={isApproving || isRejecting}
        variant="default"
      >
        {isApproving ? "מאשר..." : "אשר"}
      </Button>
      <Button
        onClick={handleReject}
        disabled={isApproving || isRejecting}
        variant="destructive"
      >
        {isRejecting ? "דוחה..." : "דחה"}
      </Button>
    </div>
  );
}
