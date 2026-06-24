"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export function PhoneVerificationToggle() {
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/v1/admin/system-settings/phone-verification");
        if (!res.ok) throw new Error("load failed");
        const data = (await res.json()) as { enabled?: boolean };
        if (!cancelled) setEnabled(data.enabled !== false);
      } catch {
        if (!cancelled) toast.error("לא ניתן לטעון את ההגדרה");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onCheckedChange = async (checked: boolean) => {
    const previous = enabled;
    setEnabled(checked);
    setSaving(true);
    try {
      const res = await fetch("/api/v1/admin/system-settings/phone-verification", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: checked }),
      });
      if (!res.ok) throw new Error("save failed");
      toast.success(checked ? "אימות טלפוני הופעל" : "אימות טלפוני כובה");
    } catch {
      setEnabled(previous);
      toast.error("שמירת ההגדרה נכשלה");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="flex items-center justify-between gap-4 rounded-lg border p-6"
      dir="rtl"
    >
      <div className="space-y-1 text-right flex-1 min-w-0">
        <Label htmlFor="phone-verification-switch" className="text-base font-semibold">
          אימות טלפוני
        </Label>
        <p className="text-sm text-muted-foreground">
          כאשר מופעל, משתמשים חייבים לאמת מספר טלפון לפני גישה לאפליקציה. כאשר כבוי, דרישת האימות מבוטלת.
        </p>
      </div>
      <Switch
        id="phone-verification-switch"
        checked={enabled}
        disabled={loading || saving}
        onCheckedChange={onCheckedChange}
        dir="ltr"
        className="shrink-0"
      />
    </div>
  );
}
