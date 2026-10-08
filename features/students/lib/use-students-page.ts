"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { DataTableSort } from "@/components/data-table";
import { createClient } from "@/lib/supabase/client";
import type { StudentTableRow } from "@/features/students/components/students-table";
import type { StudentQuery } from "@/features/students/lib/student-query-context";
import {
  buildStudentsPageQuery,
  pageCount,
} from "@/features/students/lib/students-list-query";

const LOAD_FAILED_MESSAGE = "לא הצלחנו לטעון את רשימת הכרטיסים";

/**
 * loading - הטעינה הראשונה (שלד); refreshing - עמוד/סינון/מיון חדש כשיש כבר
 * שורות על המסך (הן נשארות, עמומות, כדי שהטבלה לא תקפוץ); ready; error.
 */
export type StudentsPageStatus = "loading" | "refreshing" | "ready" | "error";

type PageData = {
  students: StudentTableRow[];
  total: number;
  status: StudentsPageStatus;
};

type Criteria = { query: StudentQuery; sort: DataTableSort | null };

const INITIAL_DATA: PageData = {
  students: [],
  total: 0,
  status: "loading",
};

/** סינון ומיון זהים בתוכן (גם כשהאובייקט חדש) אינם מצדיקים שאילתה חדשה */
function criteriaKey({ query, sort }: Criteria): string {
  return JSON.stringify([query, sort]);
}

function startLoading(previous: PageData): PageData {
  const hasRows =
    previous.status === "ready" || previous.status === "refreshing";
  return {
    ...previous,
    status: hasRows ? "refreshing" : "loading",
  };
}

const FAILED_DATA: PageData = {
  students: [],
  total: 0,
  status: "error",
};

/**
 * עמוד אחד של רשימת המיועדים מהשרת. שינוי סינון או מיון חוזר לעמוד 1.
 * תשובה של שאילתה ישנה לעולם לא דורסת חדשה: כל שינוי מבטל את הבקשה
 * הקודמת (AbortController), ותשובה שהגיעה אחרי הביטול נזרקת.
 */
export function useStudentsPage(
  query: StudentQuery,
  sort: DataTableSort | null,
) {
  const supabaseRef = useRef(createClient());
  const [criteria, setCriteria] = useState<Criteria>({ query, sort });
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [data, setData] = useState<PageData>(INITIAL_DATA);

  // התאמת מצב בזמן רינדור: קריטריונים חדשים -> עמוד 1, בלי שאילתה על
  // העמוד הישן. השוואה לפי תוכן, כי הסינון מעדכן את ההקשר גם בלי שינוי
  if (criteriaKey(criteria) !== criteriaKey({ query, sort })) {
    setCriteria({ query, sort });
    setPage(1);
  }

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setData(startLoading);
      try {
        const {
          data: rows,
          error,
          count,
        } = await buildStudentsPageQuery(
          supabaseRef.current,
          criteria.query,
          criteria.sort,
          page,
        ).abortSignal(controller.signal);
        if (controller.signal.aborted) return;
        if (error) {
          console.error("[students/list] query failed:", error);
          toast.error(LOAD_FAILED_MESSAGE);
          setData(FAILED_DATA);
          return;
        }
        const total = count ?? 0;
        // העמוד האחרון התרוקן (מחיקה, או סינון שהצטמצם): חוזרים לעמוד האחרון הקיים
        if (!rows?.length && total > 0 && page > 1) {
          setPage(pageCount(total));
          return;
        }
        // select דינמי (עם join לפי הסינון) מבלבל את הסקת הטיפוסים של supabase-js
        setData({
          students: (rows ?? []) as unknown as StudentTableRow[],
          total,
          status: "ready",
        });
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        console.error("[students/list] unexpected failure:", err);
        toast.error(LOAD_FAILED_MESSAGE);
        setData(FAILED_DATA);
      }
    }

    void load();
    return () => controller.abort();
  }, [criteria, page, reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  /** הסרה מיידית מהמסך; הטעינה מחדש ממלאת את העמוד וסופרת מחדש */
  const removeStudent = useCallback(
    (studentId: string) => {
      setData((previous) => ({
        ...previous,
        students: previous.students.filter((s) => s.id !== studentId),
        total: Math.max(0, previous.total - 1),
      }));
      reload();
    },
    [reload],
  );

  const setStudentCv = useCallback((studentId: string, cvUrl: string) => {
    setData((previous) => ({
      ...previous,
      students: previous.students.map((s) =>
        s.id === studentId ? { ...s, cv_url: cvUrl } : s,
      ),
    }));
  }, []);

  return { ...data, page, setPage, reload, removeStudent, setStudentCv };
}
