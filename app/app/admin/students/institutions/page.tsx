"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { DataTable, DataTableSkeleton } from "@/components/data-table";
import { Box, Page, PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Label } from "@/components/ui/label";
import { BulkInstitutionToolbar } from "@/features/admin/components/bulk-institution-toolbar";
import {
  bulkStudentColumns,
  type ActiveInstitution,
  type AssignmentFilter,
  type BulkStudentRow,
  type GenderFilter,
} from "@/features/admin/lib/bulk-institution-columns";
import { createClient } from "@/lib/supabase/client";

export default function BulkInstitutionAssignmentPage() {
  const [students, setStudents] = useState<BulkStudentRow[]>([]);
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

    setStudents((studentsResult.data as unknown as BulkStudentRow[]) ?? []);
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

  const selectedGenders = useMemo(
    () =>
      new Set(
        students
          .filter((student) => selectedIds.includes(student.id))
          .map((student) => student.gender),
      ),
    [students, selectedIds],
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

  return (
    <Page>
      <PageHeader
        title="שיוך מוסד המוני"
        description="שיוך מוסד לימודים למספר כרטיסי מיועדים בבת אחת"
      />
      <Box className="space-y-4">
        {loading ? (
          <DataTableSkeleton surface={false} />
        ) : loadError ? (
          <Empty size="compact" surface={false}>
            <EmptyHeader>
              <EmptyTitle>שגיאה בטעינת הנתונים</EmptyTitle>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={load}>נסה שוב</Button>
            </EmptyContent>
          </Empty>
        ) : institutions.length === 0 ? (
          <Empty size="compact" surface={false}>
            <EmptyHeader>
              <EmptyTitle>אין מוסדות פעילים במאגר</EmptyTitle>
              <EmptyDescription>
                יש ליצור מוסדות תחילה במסך ניהול המוסדות
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild>
                <Link href={"/app/admin/institutions" as any}>
                  מעבר לניהול מוסדות
                </Link>
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <>
            <BulkInstitutionToolbar
              assignmentFilter={assignmentFilter}
              onAssignmentFilterChange={setAssignmentFilter}
              genderFilter={genderFilter}
              onGenderFilterChange={setGenderFilter}
              eligibleInstitutions={eligibleInstitutions}
              selectedInstitutionId={selectedInstitutionId}
              onSelectedInstitutionChange={setSelectedInstitutionId}
              selectedCount={selectedIds.length}
              hasMixedGenderSelection={hasMixedGenderSelection}
              submitting={submitting}
              onAssign={handleAssign}
              onClear={handleClear}
            />

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
              columns={bulkStudentColumns({
                selectedIds,
                allFilteredSelected,
                onToggleAll: toggleSelectAll,
                onToggleOne: toggleSelectOne,
              })}
              rows={filteredStudents}
              getRowKey={(student) => student.id}
              emptyState={
                <Empty size="compact" surface={false}>
                  <EmptyHeader>
                    <EmptyTitle>אין כרטיסים להצגה לפי הסינון הנוכחי</EmptyTitle>
                  </EmptyHeader>
                </Empty>
              }
            />
          </>
        )}
      </Box>
    </Page>
  );
}
