"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import type { Role } from "@/lib/user-role";

const EDITABLE_ROLES: { role: Extract<Role, "admin" | "shadchan" | "staff">; label: string }[] = [
  { role: "admin", label: "מנהל" },
  { role: "shadchan", label: "שדכן" },
  { role: "staff", label: "איש צוות" },
];

interface UserRolesEditorProps {
  userId: string;
  initialRoles: Role[];
}

export function UserRolesEditor({ userId, initialRoles }: UserRolesEditorProps) {
  const router = useRouter();
  const [roles, setRoles] = useState<Set<string>>(
    () => new Set(initialRoles.filter((r) => r !== "user")),
  );
  const [isSaving, setIsSaving] = useState(false);

  const toggleRole = (role: string, checked: boolean) => {
    setRoles((prev) => {
      const next = new Set(prev);
      if (checked) next.add(role);
      else next.delete(role);
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/v1/admin/users/${userId}/roles`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles: Array.from(roles) }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "שגיאה בעדכון התפקידים");
        return;
      }

      toast.success("התפקידים עודכנו בהצלחה");
      router.refresh();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "שגיאה לא צפויה בעדכון התפקידים";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-6">
        {EDITABLE_ROLES.map(({ role, label }) => (
          <label
            key={role}
            className="flex cursor-pointer items-center gap-2 text-body-sm"
          >
            <Checkbox
              checked={roles.has(role)}
              disabled={isSaving}
              onCheckedChange={(checked) => toggleRole(role, checked === true)}
            />
            {label}
          </label>
        ))}
      </div>
      <Button onClick={handleSave} disabled={isSaving} size="sm">
        {isSaving ? "שומר..." : "שמירת תפקידים"}
      </Button>
    </div>
  );
}
