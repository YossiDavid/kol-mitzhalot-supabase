"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Box, Page, PageHeader } from "@/components/layout";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { createClient } from "@/lib/supabase/client";
import {
  INSTITUTION_GENDER_LABELS,
  INSTITUTION_TYPE_LABELS,
  type InstitutionGender,
  type InstitutionType,
} from "@/features/institutions/lib/institution-labels";

type StudentGender = InstitutionGender;

type StudentRow = {
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

type ActiveInstitution = {
  id: string;
  name: string;
  city: string | null;
  gender: InstitutionGender;
};

type AssignmentFilter = "all" | "unassigned" | "assigned";
type GenderFilter = "all" | InstitutionGender;

export default function BulkInstitutionAssignmentPage() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [institutions, setInstitutions] = useState<ActiveInstitution[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [assignmentFilter, setAssignmentFilter] =
    useState<AssignmentFilter>("unassigned");
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("all");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedInstitutionId, setSelectedInstitutionId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const supabase = createClient();

  async function load() {
    setLoading(true);
    setLoadError(false);

    const [studentsResult, institutionsResult] = await Promise.all([
      supabase
        .from("students")
        .select(
          "id, first_name, last_name, gender, city, institution_id, institutions(name, city, type)",
        )
        .is("deleted_at", null)
        .order("last_name", { ascending: true }),
      supabase
        .from("institutions")
        .select("id, name, city, gender")
        .eq("is_active", true)
        .order("name", { ascending: true }),
    ]);

    if (studentsResult.error || institutionsResult.error) {
      toast.error(
        `שגיאה בטעינת נתונים: ${
          studentsResult.error?.message ?? institutionsResult.error?.message
        }`,
      );
      setLoadError(true);
      setLoading(false);
      return;
    }

    setStudents((studentsResult.data as unknown as StudentRow[]) ?? []);
    setInstitutions(institutionsResult.data ?? []);
    setSelectedIds([]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      if (assignmentFilter === "unassigned" && student.institution_id)
        return false;
      if (assignmentFilter === "assigned" && !student.institution_id)
        return false;
      if (genderFilter !== "all" && student.gender !== genderFilter)
        return false;
      return true;
    });
  }, [students, assignmentFilter, genderFilter]);

  const unassignedCount = useMemo(
    () => students.filter((student) => !student.institution_id).length,
    [students],
  );

  const selectedStudents = useMemo(
    () => students.filter((student) => selectedIds.includes(student.id)),
    [students, selectedIds],
  );

  const selectedGenders = useMemo(
    () => new Set(selectedStudents.map((student) => student.gender)),
    [selectedStudents],
  );

  const hasMixedGenderSelection = selectedGenders.size > 1;

  const eligibleInstitutions = useMemo(() => {
    if (hasMixedGenderSelection || selectedGenders.size === 0)
      return institutions;
    const onlyGender = [...selectedGenders][0];
    return institutions.filter(
      (institution) => institution.gender === onlyGender,
    );
  }, [institutions, selectedGenders, hasMixedGenderSelection]);

  const allFilteredSelected =
    filteredStudents.length > 0 &&
    filteredStudents.every((student) => selectedIds.includes(student.id));

  function toggleSelectAll() {
    if (allFilteredSelected) {
      const filteredIdSet = new Set(filteredStudents.map((s) => s.id));
      setSelectedIds((prev) => prev.filter((id) => !filteredIdSet.has(id)));
      return;
    }
    const filteredIds = filteredStudents.map((student) => student.id);
    setSelectedIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
  }

  function toggleSelectOne(studentId: string) {
    setSelectedIds((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId],
    );
  }

  async function patchInstitution(institutionId: string | null) {
    if (selectedIds.length === 0) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/admin/students/institution", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIds: selectedIds,
          institutionId,
        }),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error(body?.error ?? "שגיאה בעדכון שיוך המוסד");
        return;
      }

      toast.success(`עודכנו ${body.updated} כרטיסים בהצלחה`);
      setSelectedInstitutionId("");
      await load();
    } catch (error) {
      toast.error(
        `שגיאה בעדכון שיוך המוסד: ${
          error instanceof Error ? error.message : "שגיאה לא צפויה"
        }`,
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleAssign() {
    if (!selectedInstitutionId) return;
    patchInstitution(selectedInstitutionId);
  }

  function handleClear() {
    const confirmed = confirm(
      `להסיר את שיוך המוסד מ-${selectedIds.length} כרטיסים נבחרים?`,
    );
    if (!confirmed) return;
    patchInstitution(null);
  }

  const studentColumns: DataTableColumn<StudentRow>[] = [
    {
      key: "select",
      header: (
        <Checkbox
          checked={allFilteredSelected}
          onCheckedChange={toggleSelectAll}
          aria-label="בחר הכל"
        />
      ),
      size: "min",
      mobile: "aside",
      cell: (student) => (
        <Checkbox
          checked={selectedIds.includes(student.id)}
          onCheckedChange={() => toggleSelectOne(student.id)}
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

  const assignDisabled =
    submitting ||
    selectedIds.length === 0 ||
    hasMixedGenderSelection ||
    !selectedInstitutionId;

  return (
    <Page>
      <PageHeader
        title="שיוך מוסד המוני"
        description="שיוך מוסד לימודים למספר כרטיסי מיועדים בבת אחת"
      />
      <Box className="space-y-4">
        {loading ? (
          <div className="py-10 text-center text-muted-foreground">טוען...</div>
        ) : loadError ? (
          <div className="py-16 text-center">
            <p className="text-subtitle font-semibold text-muted-foreground">
              שגיאה בטעינת הנתונים
            </p>
            <Button className="mt-6" onClick={load}>
              נסה שוב
            </Button>
          </div>
        ) : institutions.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-subtitle font-semibold text-muted-foreground">
              אין מוסדות פעילים במאגר
            </p>
            <p className="mt-2 text-body-sm text-muted-foreground">
              יש ליצור מוסדות תחילה במסך ניהול המוסדות
            </p>
            <Link href={"/app/admin/institutions" as any}>
              <Button className="mt-6">מעבר לניהול מוסדות</Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-48">
                <Label htmlFor="assignmentFilter">סטטוס שיוך</Label>
                <NativeSelect
                  id="assignmentFilter"
                  className="mt-1"
                  value={assignmentFilter}
                  onChange={(e) =>
                    setAssignmentFilter(e.target.value as AssignmentFilter)
                  }
                >
                  <NativeSelectOption value="all">הכל</NativeSelectOption>
                  <NativeSelectOption value="unassigned">
                    ללא מוסד
                  </NativeSelectOption>
                  <NativeSelectOption value="assigned">
                    עם מוסד
                  </NativeSelectOption>
                </NativeSelect>
              </div>
              <div className="w-40">
                <Label htmlFor="genderFilterStudents">מגדר</Label>
                <NativeSelect
                  id="genderFilterStudents"
                  className="mt-1"
                  value={genderFilter}
                  onChange={(e) =>
                    setGenderFilter(e.target.value as GenderFilter)
                  }
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
                    disabled={
                      selectedIds.length === 0 || hasMixedGenderSelection
                    }
                    onChange={(e) => setSelectedInstitutionId(e.target.value)}
                  >
                    <NativeSelectOption value="">
                      בחר מוסד...
                    </NativeSelectOption>
                    {eligibleInstitutions.map((institution) => (
                      <NativeSelectOption
                        key={institution.id}
                        value={institution.id}
                      >
                        {institution.name}
                        {institution.city ? ` (${institution.city})` : ""}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
                <Button onClick={handleAssign} disabled={assignDisabled}>
                  {submitting ? "משייך..." : "שייך מוסד"}
                </Button>
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  disabled={submitting || selectedIds.length === 0}
                  onClick={handleClear}
                >
                  הסר שיוך
                </Button>
              </div>
            </div>

            {hasMixedGenderSelection && (
              <p className="rounded-md bg-warning-muted p-3 text-body-sm text-warning-muted-foreground">
                הבחירה כוללת גם בנים וגם בנות - מוסד לימודים אחד לא יכול להתאים
                לשני המגדרים. סננו לפי מגדר לפני בחירת מוסד לשיוך.
              </p>
            )}

            <div className="flex flex-wrap gap-4 text-body-sm text-muted-foreground">
              <span>נבחרו {selectedIds.length} כרטיסים</span>
              <span>ללא מוסד: {unassignedCount}</span>
            </div>

            {filteredStudents.length > 0 && (
              // בכרטיסי המובייל אין שורת כותרת, ולכן "בחר הכל" מוצג כאן
              <div className="flex items-center gap-2 md:hidden">
                <Checkbox
                  id="selectAllMobile"
                  checked={allFilteredSelected}
                  onCheckedChange={toggleSelectAll}
                />
                <Label htmlFor="selectAllMobile">בחר הכל</Label>
              </div>
            )}

            <DataTable
              surface={false}
              caption="כרטיסים לשיוך מוסד"
              columns={studentColumns}
              rows={filteredStudents}
              getRowKey={(student) => student.id}
              emptyState={
                <div className="py-16 text-center">
                  <p className="text-subtitle font-semibold text-muted-foreground">
                    אין כרטיסים להצגה לפי הסינון הנוכחי
                  </p>
                </div>
              }
            />
          </>
        )}
      </Box>
    </Page>
  );
}
