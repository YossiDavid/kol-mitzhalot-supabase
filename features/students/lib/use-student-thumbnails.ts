"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  MAX_THUMBNAIL_BATCH,
  SIGNED_URL_CLIENT_LIFETIME_MS,
  STUDENT_THUMBNAILS_ENDPOINT,
  type StudentThumbnail,
  type StudentThumbnailsResponse,
} from "@/features/students/lib/student-photo-api";

/** מצב התמונה של שורה בלקוח: תשובת השרת, או כשל בטעינה */
export type RowPhotoState = StudentThumbnail | { status: "error" };

type CacheEntry = { state: RowPhotoState; expiresAt: number };

/** אחרי כשל לא מנסים שוב לפני שעבר הזמן הזה (ורק בטעינת רשימה חדשה) */
const ERROR_RETRY_AFTER_MS = 60 * 1000;

function toBatches(ids: readonly string[]): string[][] {
  return Array.from(
    { length: Math.ceil(ids.length / MAX_THUMBNAIL_BATCH) },
    (_, index) =>
      ids.slice(index * MAX_THUMBNAIL_BATCH, (index + 1) * MAX_THUMBNAIL_BATCH),
  );
}

async function fetchBatch(
  ids: readonly string[],
): Promise<Record<string, StudentThumbnail>> {
  const response = await fetch(STUDENT_THUMBNAILS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ studentIds: ids }),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`thumbnails request failed: ${response.status}`);
  }
  const body = (await response.json()) as StudentThumbnailsResponse;
  return body.thumbnails ?? {};
}

async function loadEntries(
  ids: readonly string[],
): Promise<ReadonlyMap<string, CacheEntry>> {
  const loadedAt = Date.now();
  try {
    const batches = await Promise.all(toBatches(ids).map(fetchBatch));
    const thumbnails = Object.assign({}, ...batches) as Record<
      string,
      StudentThumbnail
    >;
    const expiresAt = loadedAt + SIGNED_URL_CLIENT_LIFETIME_MS;
    // כרטיס שלא חזר בתשובה אינו נגיש לצופה - מוצג בלי תמונה
    return new Map(
      ids.map((id) => [
        id,
        { state: thumbnails[id] ?? { status: "none" }, expiresAt },
      ]),
    );
  } catch (error) {
    console.error("[students/thumbnails] load failed", error);
    const expiresAt = loadedAt + ERROR_RETRY_AFTER_MS;
    return new Map(
      ids.map((id) => [id, { state: { status: "error" }, expiresAt }]),
    );
  }
}

/**
 * התמונות הראשיות של שורות הטבלה. בקשה אחת לכל שינוי ברשימת המזהים, ורק
 * למזהים שעוד אין להם קישור תקף - כך שרינדור, סימון מועדף או הוספת קו״ח
 * אינם שולחים בקשה, וסינון חדש מבקש רק את השורות החדשות.
 *
 * מעבירים רק כרטיסים שיש להם תמונות (photo_count > 0).
 */
export function useStudentThumbnails(studentIds: readonly string[]) {
  const [entries, setEntries] = useState<ReadonlyMap<string, CacheEntry>>(
    () => new Map(),
  );
  // מזהים שבקשה עבורם כבר בדרך - מונע בקשה כפולה (גם ב-StrictMode)
  const inFlightRef = useRef<ReadonlySet<string>>(new Set());

  const idsKey = useMemo(
    () => [...new Set(studentIds)].sort().join(","),
    [studentIds],
  );

  useEffect(() => {
    const now = Date.now();
    const ids = idsKey ? idsKey.split(",") : [];
    const stale = ids.filter(
      (id) =>
        !inFlightRef.current.has(id) &&
        (entries.get(id)?.expiresAt ?? 0) <= now,
    );
    if (stale.length === 0) return;

    inFlightRef.current = new Set([...inFlightRef.current, ...stale]);
    void loadEntries(stale).then((loaded) => {
      const staleIds = new Set(stale);
      inFlightRef.current = new Set(
        [...inFlightRef.current].filter((id) => !staleIds.has(id)),
      );
      setEntries((previous) => new Map([...previous, ...loaded]));
    });
  }, [idsKey, entries]);

  return useCallback(
    (studentId: string): RowPhotoState | undefined =>
      entries.get(studentId)?.state,
    [entries],
  );
}
