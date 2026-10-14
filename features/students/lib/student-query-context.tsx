"use client";

import { createContext, useContext, useMemo, useState } from "react";

import type { CommunityFilter } from "@/features/students/lib/community-filter";

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
  /** "today" / "week": כרטיסים שנוצרו היום (שעון ישראל) או ב-7 הימים האחרונים. ריק = הכל */
  newCards?: string;
  /** "direct" (מועמדים והורים) / "third_party" (צד שלישי). ריק = הכל */
  cardFilledBy?: string;
  /** קהילה / חסידות (students.community). undefined = הכל מסומן, בלי סינון */
  communities?: CommunityFilter;
}

/**
 * מספר הכרטיסים התואמים לסינון הנוכחי, כפי שהרשימה חישבה אותו (אותו סכום של
 * מונה העמודים). הרשימה מפרסמת אותו כאן, והכותרת מציגה אותו - בלי שאילתה שנייה.
 * loading גם בזמן רענון: המספר הישן אינו של הסינון החדש.
 */
export type StudentsListCount =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; total: number };

interface QueryContextType {
  query: StudentQuery;
  setQuery: React.Dispatch<React.SetStateAction<StudentQuery>>;
  listCount: StudentsListCount;
  setListCount: React.Dispatch<React.SetStateAction<StudentsListCount>>;
}

/** האם יש סינון או חיפוש פעילים (שדה שאינו ריק, או סינון קהילות) */
export function hasActiveFilters(query: StudentQuery): boolean {
  return Object.values(query).some(
    (value) => value !== undefined && value !== "",
  );
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
  const [listCount, setListCount] = useState<StudentsListCount>({
    status: "loading",
  });
  const value = useMemo(
    () => ({ query, setQuery, listCount, setListCount }),
    [query, listCount],
  );
  return (
    <QueryContext.Provider value={value}>{children}</QueryContext.Provider>
  );
}
