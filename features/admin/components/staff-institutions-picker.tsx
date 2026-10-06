"use client";

import { useMemo, useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  INSTITUTION_TYPE_LABELS,
  type InstitutionType,
} from "@/features/institutions/lib/institution-labels";

export interface StaffInstitutionOption {
  id: string;
  name: string;
  city: string | null;
  type: InstitutionType;
}

/** הטקסט המלא של מוסד: שם · עיר · סוג */
export function describeInstitution(institution: StaffInstitutionOption) {
  return `${institution.name}${institution.city ? ` · ${institution.city}` : ""} · ${INSTITUTION_TYPE_LABELS[institution.type]}`;
}

/**
 * בורר מוסדות מרובה לעורך התפקידים: חיפוש חופשי + רשימת תיבות סימון.
 * (שיוכי איש צוות הם many-to-many ב-staff_institutions.)
 */
export function StaffInstitutionsPicker({
  institutions,
  selectedIds,
  disabled,
  onToggle,
}: {
  institutions: StaffInstitutionOption[];
  selectedIds: ReadonlySet<string>;
  disabled?: boolean;
  onToggle: (institutionId: string, checked: boolean) => void;
}) {
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const needle = query.trim();
    if (!needle) return institutions;
    return institutions.filter(
      (institution) =>
        selectedIds.has(institution.id) ||
        describeInstitution(institution).includes(needle),
    );
  }, [institutions, query, selectedIds]);

  return (
    <div className="space-y-2">
      <Input
        type="search"
        value={query}
        placeholder="חיפוש מוסד..."
        aria-label="חיפוש מוסד"
        onChange={(event) => setQuery(event.target.value)}
      />
      <ul
        className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-input p-2"
        data-slot="staff-institutions-list"
      >
        {visible.length === 0 && (
          <li className="text-body-sm text-muted-foreground">
            לא נמצאו מוסדות
          </li>
        )}
        {visible.map((institution) => (
          <li key={institution.id}>
            <label className="flex cursor-pointer items-center gap-2 text-body-sm">
              <Checkbox
                checked={selectedIds.has(institution.id)}
                disabled={disabled}
                onCheckedChange={(checked) =>
                  onToggle(institution.id, checked === true)
                }
              />
              {describeInstitution(institution)}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
