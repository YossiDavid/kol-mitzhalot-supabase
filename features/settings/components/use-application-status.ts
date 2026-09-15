"use client";

import { useEffect, useState } from "react";

import type { ApplicationStatus } from "@/lib/application-status";
import { createClient } from "@/lib/supabase/client";
import { hasRole } from "@/lib/user-role";
import type { InstitutionType } from "@/features/institutions/lib/institution-labels";

export type ApplicationRole = "shadchan" | "staff";

export interface ApplicationInstitution {
  name: string;
  city: string | null;
  type: InstitutionType;
}

export interface ApplicationRecord {
  application_status: ApplicationStatus | null;
  submitted_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  rejected_reason: string | null;
  /** רק לבקשת איש צוות */
  institutions?: ApplicationInstitution | null;
}

/** PGRST116 = אין שורות - אין בקשה, וזה בסדר */
const NO_ROWS_ERROR_CODE = "PGRST116";

const BASE_COLUMNS =
  "application_status, submitted_at, approved_at, rejected_at, rejected_reason";

const QUERY_BY_ROLE = {
  shadchan: {
    table: "shadchanim_info",
    columns: BASE_COLUMNS,
    logLabel: "Error fetching shadchan application:",
  },
  staff: {
    table: "staff_info",
    // כולל שם/עיר/סוג המוסד המקושר
    columns: `${BASE_COLUMNS}, institutions(name, city, type)`,
    logLabel: "Error fetching staff application:",
  },
} as const;

// PostgREST מחזיר את ה-embed כאובייקט יחיד (יחס many-to-one), אך ה-SDK
// מקליד אותו כמערך כשאין Database type - מנרמלים לאיבר הראשון בלבד.
function normalizeInstitution(value: unknown): ApplicationInstitution | null {
  const first = Array.isArray(value) ? value[0] : value;
  return (first as ApplicationInstitution | undefined) ?? null;
}

export type ApplicationStatusState =
  | { kind: "loading" }
  /** המשתמש כבר בתפקיד (או מנהל) - אין מה להציג */
  | { kind: "hasRole" }
  | { kind: "ready"; application: ApplicationRecord | null };

/** מצב בקשת ההצטרפות של המשתמש המחובר לתפקיד שדכן או איש צוות */
export function useApplicationStatus(
  role: ApplicationRole,
): ApplicationStatusState {
  const [state, setState] = useState<ApplicationStatusState>({
    kind: "loading",
  });

  useEffect(() => {
    let isCancelled = false;

    async function fetchData() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || isCancelled) return;

      if (hasRole(user, role) || hasRole(user, "admin")) {
        setState({ kind: "hasRole" });
        return;
      }

      const query = QUERY_BY_ROLE[role];
      const { data, error } = await supabase
        .from(query.table)
        .select(query.columns)
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== NO_ROWS_ERROR_CODE) {
        console.error(query.logLabel, error);
      }
      if (isCancelled) return;

      const record = data as unknown as
        | (ApplicationRecord & { institutions?: unknown })
        | null;
      setState({
        kind: "ready",
        application: record
          ? {
              ...record,
              institutions:
                role === "staff"
                  ? normalizeInstitution(record.institutions)
                  : undefined,
            }
          : null,
      });
    }

    fetchData();
    return () => {
      isCancelled = true;
    };
  }, [role]);

  return state;
}
