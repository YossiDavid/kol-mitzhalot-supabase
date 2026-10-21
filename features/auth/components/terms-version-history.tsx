"use client";

import { useEffect, useState } from "react";
import { z } from "zod";

import {
  describeTargetGroups,
  isTermsTargetGroup,
} from "@/features/auth/lib/terms-target-groups";
import { createClient } from "@/lib/supabase/client";

/** מספיק להיסטוריה בעורך; גרסאות ישנות יותר אינן רלוונטיות לחסימה */
const HISTORY_LIMIT = 20;

const rowSchema = z.object({
  version: z.number().int(),
  target_groups: z.array(z.string()).nullable(),
  published_at: z.string(),
});

type HistoryRow = {
  version: number;
  audience: string;
  publishedAt: string;
};

const dateFormatter = new Intl.DateTimeFormat("he-IL", {
  dateStyle: "short",
  timeStyle: "short",
});

function toHistoryRow(row: z.infer<typeof rowSchema>): HistoryRow {
  return {
    version: row.version,
    audience: describeTargetGroups(
      row.target_groups?.filter(isTermsTargetGroup) ?? null,
    ),
    publishedAt: dateFormatter.format(new Date(row.published_at)),
  };
}

/**
 * היסטוריית הגרסאות שפורסמו וקבוצות היעד שלהן (terms_versions - קריאה
 * למנהל בלבד). נטענת מחדש כשהגרסה הנוכחית משתנה (אחרי פרסום).
 */
export function TermsVersionHistory({ version }: { version: number }) {
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    const load = async () => {
      const { data, error } = await createClient()
        .from("terms_versions")
        .select("version, target_groups, published_at")
        .order("version", { ascending: false })
        .limit(HISTORY_LIMIT);
      if (isCancelled) return;
      const parsed = z.array(rowSchema).safeParse(data ?? []);
      if (error || !parsed.success) {
        console.error("[terms/history]", error?.message ?? parsed.error);
        setHasError(true);
        return;
      }
      setHasError(false);
      setRows(parsed.data.map(toHistoryRow));
    };
    void load();
    return () => {
      isCancelled = true;
    };
  }, [version]);

  if (hasError) {
    return (
      <p className="text-body-sm text-destructive">
        טעינת היסטוריית הגרסאות נכשלה
      </p>
    );
  }
  if (!rows) return null;

  return (
    <div className="space-y-2" data-testid="terms-version-history">
      <p className="font-bold">גרסאות שפורסמו</p>
      {rows.length === 0 ? (
        <p className="text-body-sm text-muted-foreground">
          עדיין לא פורסמה גרסה עם קבוצות יעד. גרסאות קודמות חלות על כל המשתמשים.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border text-body-sm">
          {rows.map((row) => (
            <li
              key={row.version}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
              data-testid="terms-version-history-row"
            >
              <span className="font-semibold">גרסה {row.version}</span>
              <span>{row.audience}</span>
              <span className="text-muted-foreground">{row.publishedAt}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
