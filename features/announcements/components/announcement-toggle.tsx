"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/** הסתרה/הפעלה של הודעה: מוסתרת אינה מוצגת עוד בבאנר */
export function AnnouncementToggle({ id, isActive }: { id: string; isActive: boolean }) {
  const router = useRouter();
  const [isBusy, setIsBusy] = useState(false);

  async function toggle() {
    setIsBusy(true);
    const res = await fetch("/api/v1/admin/announcements", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isActive: !isActive }),
    }).catch(() => null);
    setIsBusy(false);
    if (!res?.ok) {
      toast.error("העדכון נכשל");
      return;
    }
    router.refresh();
  }

  return (
    <Button type="button" variant="outline" size="sm" disabled={isBusy} onClick={() => void toggle()}>
      {isActive ? "הסתרה" : "הצגה מחדש"}
    </Button>
  );
}
