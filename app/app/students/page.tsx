"use client";

import { createContext, useContext, useState } from "react";
import FilterSection from "./sections/filter";
import StudentsList from "./sections/list";

export interface StudentQuery {
  first_name?: string;
  last_name?: string;
  gender?: string;
  personal_status?: string;
  ageMin?: string;
  height?: string;
  father_name?: string;
  city?: string;
  employment?: string;
  yeshiva_name?: string;
  yeshiva_city?: string;
  class?: string;
  is_yeshiva?: string | boolean;
  is_reservoir?: boolean;
}

interface QueryContextType {
  query: StudentQuery;
  setQuery: React.Dispatch<React.SetStateAction<StudentQuery>>;
}

// כאן אנחנו אומרים ל-TypeScript מה הטיפוס של ה-Context
export const QueryContext = createContext<QueryContextType | undefined>(
  undefined,
);

export function useStudentQuery() {
  const context = useContext(QueryContext);
  if (!context) {
    throw new Error(
      "useStudentQuery must be used within a QueryContext.Provider",
    );
  }
  return context;
}

export default function StudentsPage() {
  const [query, setQuery] = useState<StudentQuery>({});

  return (
    <QueryContext.Provider value={{ query, setQuery }}>
      <FilterSection />
      <StudentsList />
    </QueryContext.Provider>
  );
}
