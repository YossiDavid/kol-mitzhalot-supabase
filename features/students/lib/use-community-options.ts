"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { mergeCommunityOptions } from "@/features/students/lib/community-filter";
import { createClient } from "@/lib/supabase/client";

/** PostgREST מגביל כל תשובה (ברירת מחדל 1000 שורות), ולכן קוראים בדפים */
const COMMUNITY_PAGE_SIZE = 1000;

/** קהילות פעילות במאגר */
async function fetchCatalogNames(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase
    .from("communities")
    .select("name")
    .eq("is_active", true);
  if (error) throw error;
  return (data ?? []).map((row) => row.name as string);
}

/**
 * הערכים הלא-ריקים שבכרטיסים בפועל. אין DISTINCT ב-PostgREST, ולכן שולפים
 * רק את העמודה בדפים ומסירים כפילויות בלקוח.
 */
async function fetchPresentNames(supabase: SupabaseClient): Promise<string[]> {
  const names = new Set<string>();
  for (let from = 0; ; from += COMMUNITY_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("students")
      .select("community")
      .is("deleted_at", null)
      .not("community", "is", null)
      .order("id")
      .range(from, from + COMMUNITY_PAGE_SIZE - 1);
    if (error) throw error;
    const rows = data ?? [];
    rows.forEach((row) => {
      if (typeof row.community === "string") names.add(row.community);
    });
    if (rows.length < COMMUNITY_PAGE_SIZE) break;
  }
  return [...names];
}

export type CommunityOptionsState = {
  /** NO_COMMUNITY_KEY ראשון, ואחריו השמות במיון עברי */
  options: string[];
  isLoading: boolean;
  /** כשל בטעינה: הסינון לא זמין, אבל שאר המסך עובד */
  error: string | null;
};

/** אפשרויות הבחירה של סינון הקהילה: איחוד המאגר והערכים שבכרטיסים */
export function useCommunityOptions(): CommunityOptionsState {
  const [state, setState] = useState<CommunityOptionsState>({
    options: mergeCommunityOptions([], []),
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    Promise.all([fetchCatalogNames(supabase), fetchPresentNames(supabase)])
      .then(([catalog, present]) => {
        if (!isMounted) return;
        setState({
          options: mergeCommunityOptions(catalog, present),
          isLoading: false,
          error: null,
        });
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        console.error("[students/filter] loading communities failed:", err);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err instanceof Error ? err.message : "שגיאה לא צפויה",
        }));
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return state;
}
