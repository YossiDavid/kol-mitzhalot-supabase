"use client";

import { Page } from "@/components/layout";
import { StudentQueryProvider } from "@/features/students/lib/student-query-context";
import FilterSection from "@/features/students/components/filter";
import StudentsList from "@/features/students/components/list";

export default function StudentsPage() {
  return (
    <StudentQueryProvider>
      {/* המרווחים בין החלקים נקבעים בתוכם (מסננים שונים למובייל ולדסקטופ) */}
      <Page className="gap-0">
        <FilterSection />
        <StudentsList />
      </Page>
    </StudentQueryProvider>
  );
}
