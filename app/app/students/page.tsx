"use client";

import { StudentQueryProvider } from "@/features/students/lib/student-query-context";
import FilterSection from "@/features/students/components/filter";
import StudentsList from "@/features/students/components/list";

export default function StudentsPage() {
  return (
    <StudentQueryProvider>
      <FilterSection />
      <StudentsList />
    </StudentQueryProvider>
  );
}
