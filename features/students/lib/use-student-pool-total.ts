"use client";

import { useEffect, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { buildStudentsPoolCountQuery } from "@/features/students/lib/students-list-query";

export type StudentPoolTotal =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; total: number };

/**
 * סך הכרטיסים במאגר בלי סינון (שאילתת ספירה אחת, בלי שורות), לתצוגת
 * "מתוך N במאגר". נטען רק כש-`enabled` (סינון פעיל) ומתרענן בכל הפעלה מחדש.
 */
export function useStudentPoolTotal(enabled: boolean): StudentPoolTotal {
  const supabaseRef = useRef(createClient());
  const [state, setState] = useState<StudentPoolTotal>({ status: "loading" });

  useEffect(() => {
    if (!enabled) return;
    let isCurrent = true;
    void (async () => {
      try {
        const { count, error } = await buildStudentsPoolCountQuery(
          supabaseRef.current,
        );
        if (!isCurrent) return;
        if (error || count === null) {
          if (error) console.error("[students/pool] count failed:", error);
          setState({ status: "error" });
          return;
        }
        setState({ status: "ready", total: count });
      } catch (err: unknown) {
        if (!isCurrent) return;
        console.error("[students/pool] unexpected failure:", err);
        setState({ status: "error" });
      }
    })();
    return () => {
      isCurrent = false;
    };
  }, [enabled]);

  return state;
}
