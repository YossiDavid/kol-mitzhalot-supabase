"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { DataTableSort } from "@/components/data-table";
import { createClient } from "@/lib/supabase/client";
import type { StudentTableRow } from "@/features/students/components/students-table";
import type { StudentQuery } from "@/features/students/lib/student-query-context";
import { withMatchmakingHold } from "@/features/students/lib/card-matchmaking-hold";
import {
  buildStudentsPageQuery,
  pageCount,
} from "@/features/students/lib/students-list-query";

const LOAD_FAILED_MESSAGE = "לא הצלחנו לטעון את רשימת הכרטיסים";

/** מספר העמוד נשמר בכתובת (?page=), כדי שחזרה מכרטיס תחזיר לאותו עמוד */
const PAGE_PARAM = "page";

function readPageFromUrl(): number {
  const raw = new URLSearchParams(window.location.search).get(PAGE_PARAM);
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 1 ? parsed : 1;
}

function writePageToUrl(page: number) {
  const url = new URL(window.location.href);
  if (page > 1) url.searchParams.set(PAGE_PARAM, String(page));
  else url.searchParams.delete(PAGE_PARAM);
  // replaceState משולב בראוטר של Next ואינו גורם לניווט או לרינדור שרת
  window.history.replaceState(window.history.state, "", url);
}

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
  // null עד שהעמוד נקרא מהכתובת אחרי הטעינה (בשרת אין window)
  const [page, setPageState] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [data, setData] = useState<PageData>(INITIAL_DATA);

  // התאמת מצב בזמן רינדור: קריטריונים חדשים -> עמוד 1, בלי שאילתה על
  // העמוד הישן. השוואה לפי תוכן, כי הסינון מעדכן את ההקשר גם בלי שינוי
  if (criteriaKey(criteria) !== criteriaKey({ query, sort })) {
    setCriteria({ query, sort });
    if (page !== null) setPageState(1);
  }

  useEffect(() => {
    setPageState(readPageFromUrl());
  }, []);

  useEffect(() => {
    if (page !== null) writePageToUrl(page);
  }, [page]);

  const setPage = useCallback((next: number) => setPageState(next), []);

  useEffect(() => {
    if (page === null) return;
    const currentPage = page;
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
          currentPage,
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
        if (!rows?.length && total > 0 && currentPage > 1) {
          setPageState(pageCount(total));
          return;
        }
        // select דינמי (עם join לפי הסינון) מבלבל את הסקת הטיפוסים של supabase-js
        const students = await withMatchmakingHold(
          supabaseRef.current,
          (rows ?? []) as unknown as StudentTableRow[],
        );
        if (controller.signal.aborted) return;
        setData({ students, total, status: "ready" });
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

  return {
    ...data,
    page: page ?? 1,
    setPage,
    reload,
    removeStudent,
    setStudentCv,
  };
}
