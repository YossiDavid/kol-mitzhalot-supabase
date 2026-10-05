"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type Props = {
  studentId: string;
  studentName: string;
  isPaused: boolean;
};

/**
 * השהיית כרטיס ע"י הנהלה / ביטול ההשהיה. כל עוד הכרטיס מושהה כך, מנהל
 * הכרטיס אינו יכול להחזיר אותו לשידוכים (נעילה במסד).
 */
export function AdminPauseButton({ studentId, studentName, isPaused }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/students/${studentId}/admin-pause`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paused: !isPaused }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "עדכון ההשהיה נכשל");
        return;
      }
      toast.success(isPaused ? "ההשהיה בוטלה" : "הכרטיס הושהה");
      router.refresh();
    } catch {
      toast.error("עדכון ההשהיה נכשל");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      size="sm"
      variant={isPaused ? "outline" : "secondary"}
      onClick={handleClick}
      disabled={loading}
      aria-label={`${isPaused ? "ביטול השהיה" : "השהיית כרטיס"}: ${studentName}`}
    >
      {isPaused ? "ביטול השהיה" : "השהיית כרטיס"}
    </Button>
  );
}
