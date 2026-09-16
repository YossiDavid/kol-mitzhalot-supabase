"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import type {
  ActiveInstitution,
  AssignmentFilter,
  GenderFilter,
} from "@/features/admin/lib/bulk-institution-columns";

/** פאנל הסינון והשיוך מעל טבלת השיוך ההמוני */
export function BulkInstitutionToolbar({
  assignmentFilter,
  onAssignmentFilterChange,
  genderFilter,
  onGenderFilterChange,
  eligibleInstitutions,
  selectedInstitutionId,
  onSelectedInstitutionChange,
  selectedCount,
  hasMixedGenderSelection,
  submitting,
  onAssign,
  onClear,
}: {
  assignmentFilter: AssignmentFilter;
  onAssignmentFilterChange: (value: AssignmentFilter) => void;
  genderFilter: GenderFilter;
  onGenderFilterChange: (value: GenderFilter) => void;
  eligibleInstitutions: ActiveInstitution[];
  selectedInstitutionId: string;
  onSelectedInstitutionChange: (value: string) => void;
  selectedCount: number;
  hasMixedGenderSelection: boolean;
  submitting: boolean;
  onAssign: () => void;
  onClear: () => void;
}) {
  const assignDisabled =
    submitting ||
    selectedCount === 0 ||
    hasMixedGenderSelection ||
    !selectedInstitutionId;

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-48">
        <Label htmlFor="assignmentFilter">סטטוס שיוך</Label>
        <NativeSelect
          id="assignmentFilter"
          className="mt-1"
          value={assignmentFilter}
          onChange={(e) =>
            onAssignmentFilterChange(e.target.value as AssignmentFilter)
          }
        >
          <NativeSelectOption value="all">הכל</NativeSelectOption>
          <NativeSelectOption value="unassigned">ללא מוסד</NativeSelectOption>
          <NativeSelectOption value="assigned">עם מוסד</NativeSelectOption>
        </NativeSelect>
      </div>
      <div className="w-40">
        <Label htmlFor="genderFilterStudents">מגדר</Label>
        <NativeSelect
          id="genderFilterStudents"
          className="mt-1"
          value={genderFilter}
          onChange={(e) => onGenderFilterChange(e.target.value as GenderFilter)}
        >
          <NativeSelectOption value="all">הכל</NativeSelectOption>
          <NativeSelectOption value="male">בנים</NativeSelectOption>
          <NativeSelectOption value="female">בנות</NativeSelectOption>
        </NativeSelect>
      </div>

      <div className="flex flex-1 flex-wrap items-end gap-3">
        <div className="min-w-52 flex-1">
          <Label htmlFor="institutionPicker">מוסד לשיוך</Label>
          <NativeSelect
            id="institutionPicker"
            className="mt-1"
            value={selectedInstitutionId}
            disabled={selectedCount === 0 || hasMixedGenderSelection}
            onChange={(e) => onSelectedInstitutionChange(e.target.value)}
          >
            <NativeSelectOption value="">בחר מוסד...</NativeSelectOption>
            {eligibleInstitutions.map((institution) => (
              <NativeSelectOption key={institution.id} value={institution.id}>
                {institution.name}
                {institution.city ? ` (${institution.city})` : ""}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <Button onClick={onAssign} disabled={assignDisabled}>
          {submitting ? "משייך..." : "שייך מוסד"}
        </Button>
        <Button
          variant="outline"
          className="text-destructive hover:text-destructive"
          disabled={submitting || selectedCount === 0}
          onClick={onClear}
        >
          הסר שיוך
        </Button>
      </div>
    </div>
  );
}
