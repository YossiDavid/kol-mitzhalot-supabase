"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserRoundCog } from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { personalStatusToHebrew } from "@/features/students/lib/profile-labels";

/**
 * אותם ערכים בדיוק שה-API מקבל (bodySchema ב-
 * app/api/v1/students/[studentId]/status/route.ts). התוויות נגזרות
 * מ-personalStatusToHebrew - אותו מקור אמת שמציג את הסטטוס בכרטיס, ולכן אין
 * טבלת תוויות כפולה שיכולה להיסחף.
 */
const STATUS_VALUES = [
  "single",
  "engaged",
  "married",
  "divorced",
  "widowed",
] as const;

export type PersonalStatus = (typeof STATUS_VALUES)[number];

/**
 * "עדכון סטטוס" - פריט יחיד בתפריט הפעולות שנפתח לרשימת הסטטוסים. הבחירה
 * נשמרת מיד (אין כפתור "שמור" נפרד), ולכן אין כאן שום כפתור שיושב בהדר.
 * הרשאה: שדכן/מנהל בלבד - נאכפת גם ב-API.
 */
export function StudentStatusMenu({
  studentId,
  currentStatus,
  gender,
}: {
  studentId: string;
  currentStatus: PersonalStatus | null;
  gender: "male" | "female" | null;
}) {
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function updateStatus(next: string) {
    if (saving || next === currentStatus) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/v1/students/${studentId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "שגיאה בעדכון סטטוס");
        return;
      }
      toast.success("הסטטוס עודכן בהצלחה");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("שגיאה בעדכון סטטוס");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DropdownMenuSub>
      {/* החץ של תת-התפריט מסובב, כי התפריט נפתח שמאלה בממשק RTL */}
      <DropdownMenuSubTrigger className="[&>svg:last-child]:rotate-180">
        <UserRoundCog />
        עדכון סטטוס
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuRadioGroup
          value={currentStatus ?? ""}
          onValueChange={(next) => {
            void updateStatus(next);
          }}
        >
          {STATUS_VALUES.map((value) => (
            <DropdownMenuRadioItem key={value} value={value} disabled={saving}>
              {personalStatusToHebrew(value, gender ?? undefined)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
