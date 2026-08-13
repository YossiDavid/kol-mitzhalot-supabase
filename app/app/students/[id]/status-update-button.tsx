"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const STATUS_OPTIONS = [
  { value: "single", labelM: "רווק", labelF: "רווקה" },
  { value: "engaged", labelM: "מאורס", labelF: "מאורסת" },
  { value: "married", labelM: "נשוי", labelF: "נשואה" },
  { value: "divorced", labelM: "גרוש", labelF: "גרושה" },
  { value: "widowed", labelM: "אלמן", labelF: "אלמנה" },
] as const;

type PersonalStatus = (typeof STATUS_OPTIONS)[number]["value"];

export default function StatusUpdateButton({
  studentId,
  currentStatus,
  gender,
}: {
  studentId: string;
  currentStatus: PersonalStatus | null;
  gender: "male" | "female" | null;
}) {
  const [status, setStatus] = useState<PersonalStatus | "">(
    currentStatus ?? "",
  );
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const label = (opt: (typeof STATUS_OPTIONS)[number]) =>
    gender === "female" ? opt.labelF : opt.labelM;

  async function handleSave() {
    if (!status) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/students/${studentId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "שגיאה בעדכון סטטוס");
        return;
      }
      toast.success("הסטטוס עודכן בהצלחה");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2" dir="rtl">
      <Select
        value={status}
        onValueChange={(v) => setStatus(v as PersonalStatus)}
      >
        <SelectTrigger className="h-8 w-36 text-body-sm">
          <SelectValue placeholder="עדכן סטטוס" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {label(opt)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        onClick={handleSave}
        disabled={saving || !status || status === currentStatus}
      >
        {saving ? "שומר..." : "שמור"}
      </Button>
    </div>
  );
}
