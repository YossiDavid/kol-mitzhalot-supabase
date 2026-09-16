"use client";

import type { DataTableColumn } from "@/components/data-table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  INSTITUTION_GENDER_LABELS,
  INSTITUTION_TYPE_LABELS,
  type InstitutionGender,
  type InstitutionType,
} from "@/features/institutions/lib/institution-labels";

export type StudentGender = InstitutionGender;

export type BulkStudentRow = {
  id: string;
  first_name: string;
  last_name: string;
  gender: StudentGender;
  city: string | null;
  institution_id: string | null;
  institutions: {
    name: string;
    city: string | null;
    type: InstitutionType;
  } | null;
};

export type ActiveInstitution = {
  id: string;
  name: string;
  city: string | null;
  gender: InstitutionGender;
};

export type AssignmentFilter = "all" | "unassigned" | "assigned";
export type GenderFilter = "all" | InstitutionGender;

/** עמודות טבלת השיוך ההמוני, כולל תיבות הבחירה */
export function bulkStudentColumns({
  selectedIds,
  allFilteredSelected,
  onToggleAll,
  onToggleOne,
}: {
  selectedIds: string[];
  allFilteredSelected: boolean;
  onToggleAll: () => void;
  onToggleOne: (studentId: string) => void;
}): DataTableColumn<BulkStudentRow>[] {
  return [
    {
      key: "select",
      header: (
        <Checkbox
          checked={allFilteredSelected}
          onCheckedChange={onToggleAll}
          aria-label="בחר הכל"
        />
      ),
      size: "min",
      mobile: "aside",
      cell: (student) => (
        <Checkbox
          checked={selectedIds.includes(student.id)}
          onCheckedChange={() => onToggleOne(student.id)}
          aria-label={`בחר את ${student.first_name} ${student.last_name}`}
        />
      ),
    },
    {
      key: "name",
      header: "שם",
      mobile: "title",
      className: "font-medium",
      cell: (student) => `${student.first_name} ${student.last_name}`,
    },
    {
      key: "gender",
      header: "מגדר",
      size: "min",
      className: "text-muted-foreground",
      cell: (student) => INSTITUTION_GENDER_LABELS[student.gender],
    },
    {
      key: "city",
      header: "עיר",
      className: "text-muted-foreground",
      cell: (student) => student.city ?? "-",
    },
    {
      key: "institution",
      header: "מוסד נוכחי",
      size: "grow",
      className: "text-muted-foreground",
      cell: (student) =>
        student.institutions
          ? `${student.institutions.name}${
              student.institutions.city ? ` (${student.institutions.city})` : ""
            } - ${INSTITUTION_TYPE_LABELS[student.institutions.type]}`
          : "—",
    },
  ];
}
