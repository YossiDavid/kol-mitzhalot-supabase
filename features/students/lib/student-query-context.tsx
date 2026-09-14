"use client";

import { createContext, useContext, useState } from "react";

/**
 * סינון רשימת המיועדים. כל שדה כאן מוחל בפועל בשאילתה ב-
 * features/students/components/list.tsx - שדה שאין לו מימוש שם לא נכנס לכאן.
 */
export interface StudentQuery {
  /** חיפוש חופשי: שם, עיר, קהילה, שטיבל */
  search?: string;
  first_name?: string;
  last_name?: string;
  /** parents_info.father.self.name */
  father_name?: string;
  gender?: string;
  personal_status?: string;
  city?: string;
  ageMin?: string;
  ageMax?: string;
  /** בס״מ */
  heightMin?: string;
  heightMax?: string;
  /** employment_history.category */
  employment?: string;
  /** שם מוסד לימודים - education_history.name */
  institution?: string;
  /** "true" / "false", ריק = הכל */
  is_yeshiva?: string;
}

interface QueryContextType {
  query: StudentQuery;
  setQuery: React.Dispatch<React.SetStateAction<StudentQuery>>;
}

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

export function StudentQueryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [query, setQuery] = useState<StudentQuery>({});
  return (
    <QueryContext.Provider value={{ query, setQuery }}>
      {children}
    </QueryContext.Provider>
  );
}
