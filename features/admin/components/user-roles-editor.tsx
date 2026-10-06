"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/lib/user-role";
import {
  StaffInstitutionsPicker,
  type StaffInstitutionOption,
} from "@/features/admin/components/staff-institutions-picker";

const EDITABLE_ROLES: {
  role: Extract<Role, "admin" | "shadchan" | "staff">;
  label: string;
}[] = [
  { role: "admin", label: "מנהל" },
  { role: "shadchan", label: "שדכן" },
  { role: "staff", label: "איש צוות" },
];

interface UserRolesEditorProps {
  userId: string;
  initialRoles: Role[];
  /** המוסדות שאיש הצוות משויך אליהם כרגע (staff_institutions) */
  initialInstitutionIds?: string[];
}

export function UserRolesEditor({
  userId,
  initialRoles,
  initialInstitutionIds = [],
}: UserRolesEditorProps) {
  const router = useRouter();
  const [roles, setRoles] = useState<Set<string>>(
    () => new Set(initialRoles.filter((r) => r !== "user")),
  );
  const [institutionIds, setInstitutionIds] = useState<Set<string>>(
    () => new Set(initialInstitutionIds),
  );
  const [institutions, setInstitutions] = useState<StaffInstitutionOption[]>(
    [],
  );
  const [isInstitutionsLoading, setIsInstitutionsLoading] = useState(true);
  const [institutionsError, setInstitutionsError] = useState<string | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function fetchInstitutions() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("institutions")
        .select("id, name, city, type")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) {
        setInstitutionsError(`שגיאה בטעינת רשימת המוסדות: ${error.message}`);
        setIsInstitutionsLoading(false);
        return;
      }

      setInstitutions(data ?? []);
      setIsInstitutionsLoading(false);
    }

    fetchInstitutions();
  }, []);

  const toggleRole = (role: string, checked: boolean) => {
    setRoles((prev) => {
      const next = new Set(prev);
      if (checked) next.add(role);
      else next.delete(role);
      return next;
    });
  };

  const toggleInstitution = (institutionId: string, checked: boolean) => {
    setInstitutionIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(institutionId);
      else next.delete(institutionId);
      return next;
    });
  };

  const isStaffChecked = roles.has("staff");
  const isMissingInstitution = isStaffChecked && institutionIds.size === 0;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/v1/admin/users/${userId}/roles`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roles: Array.from(roles),
          institutionIds: isStaffChecked ? Array.from(institutionIds) : [],
        }),
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
        error instanceof Error
          ? error.message
          : "שגיאה לא צפויה בעדכון התפקידים";
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

      {isStaffChecked && (
        <div className="max-w-xl space-y-1">
          <label className="text-body-sm font-medium">
            מוסדות לימוד <span className="text-destructive">*</span>
          </label>
          {institutionsError ? (
            <p className="text-body-sm text-destructive">{institutionsError}</p>
          ) : !isInstitutionsLoading && institutions.length === 0 ? (
            <p className="text-body-sm text-muted-foreground">
              לא הוגדרו עדיין מוסדות לימוד במערכת.{" "}
              <Link
                href="/app/admin/institutions"
                className="text-primary underline"
              >
                הוספת מוסד
              </Link>
            </p>
          ) : (
            <>
              <StaffInstitutionsPicker
                institutions={institutions}
                selectedIds={institutionIds}
                disabled={isSaving || isInstitutionsLoading}
                onToggle={toggleInstitution}
              />
              {isMissingInstitution && (
                <p
                  role="alert"
                  data-slot="staff-institution-required"
                  className="text-body-sm text-destructive"
                >
                  יש לבחור לפחות מוסד לימודים אחד כדי להעניק תפקיד &quot;איש
                  צוות&quot;
                </p>
              )}
            </>
          )}
        </div>
      )}

      <Button
        onClick={handleSave}
        disabled={isSaving || isMissingInstitution}
        size="sm"
      >
        {isSaving ? "שומר..." : "שמירת תפקידים"}
      </Button>
    </div>
  );
}
