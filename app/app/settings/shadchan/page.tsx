"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";

import { Page, PageHeader } from "@/components/layout";
import { CardSkeleton } from "@/components/ui/card-skeleton";
import { SkeletonRegion } from "@/components/ui/skeleton";
import {
  identityFromUser,
  type PreviewIdentity,
} from "@/features/shadchanim/lib/preview-card";
import { ShadchanProfileFormCard } from "@/features/shadchanim/components/shadchan-profile-form-card";
import {
  EMPTY_SHADCHAN_FORM,
  formToColumns,
  rowToForm,
  SHADCHAN_PROFILE_SELECT,
  type ShadchanFormData,
} from "@/features/shadchanim/lib/profile-form";
import { ApplicationMessagesCard } from "@/features/settings/components/application-messages-card";
import { shadchanProfileHref } from "@/features/shadchanim/lib/types";
import { createClient } from "@/lib/supabase/client";
import { hasRole } from "@/lib/user-role";

/** מספר שדות הטופס, לשלד הטעינה. */
const FORM_FIELD_COUNT = 13;

/** הודעות קבועות למשתמש כששמירה נכשלת (הפרטים הטכניים נרשמים בקונסול) */
const SUBMIT_ERROR_MESSAGE = "שליחת הבקשה נכשלה, נסו שוב";
const SAVE_ERROR_MESSAGE = "שמירת הפרופיל נכשלה, נסו שוב";

/** PGRST116 = אין שורות */
const NO_ROWS_ERROR_CODE = "PGRST116";

const JOIN_COPY = {
  title: "הצטרפות כשדכן",
  description: "מלא את הפרטים הבאים כדי להגיש בקשה להצטרפות כשדכן במערכת",
} as const;

const EDIT_COPY = {
  title: "עריכת פרופיל שדכן",
  description: "עדכן את הפרטים שמוצגים בפרופיל שלך. הסטטוס שלך לא ישתנה.",
} as const;

/**
 * מצב העמוד: טופס הצטרפות (עם בקשה קיימת אם יש), או עריכת הפרופיל של שדכן
 * מאושר. מי שמוגדר שדכן בלי שורה מאושרת, ומנהל, מוּפנים להגדרות.
 */
type PageState =
  | { kind: "loading" }
  | {
      kind: "join";
      defaults: ShadchanFormData;
      hasExistingApplication: boolean;
      identity: PreviewIdentity;
    }
  | {
      kind: "edit";
      userId: string;
      defaults: ShadchanFormData;
      identity: PreviewIdentity;
    };

/** שלד העמוד, זהה במבנה לתוכן האמיתי כדי שלא תהיה קפיצה. */
function ShadchanPageSkeleton() {
  return (
    <Page width="form-aside">
      <PageHeader title={JOIN_COPY.title} description={JOIN_COPY.description} />
      <SkeletonRegion>
        <CardSkeleton fields={FORM_FIELD_COUNT} footer />
      </SkeletonRegion>
    </Page>
  );
}

/** הטופס נשען על react-hook-form, ולכן יושב מאחורי גבול Suspense. */
export default function ShadchanSettingsPage() {
  return (
    <Suspense fallback={<ShadchanPageSkeleton />}>
      <ShadchanSettingsContent />
    </Suspense>
  );
}

function ShadchanSettingsContent() {
  const router = useRouter();
  const [state, setState] = useState<PageState>({ kind: "loading" });

  useEffect(() => {
    let isCancelled = false;

    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth/login");
        return;
      }

      // מנהל: אין לו בקשה ואין פרופיל משלו לערוך כאן
      if (hasRole(user, "admin")) {
        router.push("/app/settings");
        return;
      }

      const [{ data, error }, { data: profile }] = await Promise.all([
        supabase
          .from("shadchanim_info")
          .select(`application_status, ${SHADCHAN_PROFILE_SELECT}`)
          .eq("user_id", user.id)
          .single(),
        supabase
          .from("user_profiles")
          .select("first_name, last_name")
          .eq("id", user.id)
          .maybeSingle(),
      ]);
      const identity = identityFromUser(user, profile);

      if (error && error.code !== NO_ROWS_ERROR_CODE) {
        console.error("Error fetching shadchan row:", error);
      }
      if (isCancelled) return;

      if (hasRole(user, "shadchan")) {
        if (data?.application_status !== "approved") {
          router.push("/app/settings");
          return;
        }
        setState({
          kind: "edit",
          userId: user.id,
          defaults: rowToForm(data),
          identity,
        });
        return;
      }

      setState({
        kind: "join",
        defaults: data ? rowToForm(data) : EMPTY_SHADCHAN_FORM,
        hasExistingApplication: Boolean(data),
        identity,
      });
    }

    load();
    return () => {
      isCancelled = true;
    };
  }, [router]);

  if (state.kind === "loading") {
    return <ShadchanPageSkeleton />;
  }

  if (state.kind === "edit") {
    return (
      <EditOwnProfile
        userId={state.userId}
        defaults={state.defaults}
        identity={state.identity}
      />
    );
  }

  return (
    <JoinApplication
      defaults={state.defaults}
      hasExistingApplication={state.hasExistingApplication}
      identity={state.identity}
    />
  );
}

function JoinApplication({
  defaults,
  hasExistingApplication,
  identity,
}: {
  defaults: ShadchanFormData;
  hasExistingApplication: boolean;
  identity: PreviewIdentity;
}) {
  const router = useRouter();

  const onSubmit = async (data: ShadchanFormData) => {
    const supabase = createClient();

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error("יש להתחבר למערכת");
        return;
      }

      const insertData: Record<string, unknown> = {
        user_id: user.id,
        ...formToColumns(data),
      };

      // בקשה חדשה: סטטוס ממתין ותאריך הגשה
      if (!hasExistingApplication) {
        insertData.application_status = "pending";
        insertData.submitted_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("shadchanim_info")
        .upsert(insertData, { onConflict: "user_id" });

      if (error) throw error;

      toast.success(
        hasExistingApplication
          ? "הבקשה עודכנה בהצלחה"
          : "הבקשה נשלחה בהצלחה וממתינה לאישור",
      );
      router.push("/app/settings");
    } catch (error: unknown) {
      toast.error(SUBMIT_ERROR_MESSAGE);
      console.error("Error submitting shadchan application:", error);
    }
  };

  return (
    <Page width="form-aside">
      <PageHeader title={JOIN_COPY.title} description={JOIN_COPY.description} />
      <ApplicationMessagesCard kind="shadchan" />
      <ShadchanProfileFormCard
        title="טופס הצטרפות"
        description="אנא מלא את כל הפרטים הרלוונטיים. הבקשה תבדק על ידי מנהל המערכת."
        defaultValues={defaults}
        submitLabel={hasExistingApplication ? "עדכן בקשה" : "שלח בקשה"}
        pendingLabel="שולח..."
        cancelHref="/app/settings"
        previewIdentity={identity}
        showApplicationNote
        onSubmit={onSubmit}
      />
    </Page>
  );
}

function EditOwnProfile({
  userId,
  defaults,
  identity,
}: {
  userId: string;
  defaults: ShadchanFormData;
  identity: PreviewIdentity;
}) {
  const router = useRouter();
  const profileHref = shadchanProfileHref(userId) as Route;

  const onSubmit = async (data: ShadchanFormData) => {
    const supabase = createClient();

    try {
      // עדכון עמודות הפרופיל בלבד: הסטטוס ותאריכיו לא נשלחים (והטריגר שומר עליהם)
      const { data: updated, error } = await supabase
        .from("shadchanim_info")
        // ההערה להנהלה היא של שלב הבקשה; בעריכה עצמית היא לא נכתבת
        .update(formToColumns(data, { includeApplicationNote: false }))
        .eq("user_id", userId)
        .select("user_id");

      if (error) throw error;
      if (!updated || updated.length === 0) {
        throw new Error("no shadchanim_info row updated");
      }

      toast.success("הפרופיל עודכן בהצלחה");
      router.push(profileHref);
      router.refresh();
    } catch (error: unknown) {
      toast.error(SAVE_ERROR_MESSAGE);
      console.error("Error updating shadchan profile:", error);
    }
  };

  return (
    <Page width="form-aside">
      <PageHeader title={EDIT_COPY.title} description={EDIT_COPY.description} />
      <ApplicationMessagesCard kind="shadchan" />
      <ShadchanProfileFormCard
        title="פרטי הפרופיל"
        description="הפרטים שיוצגו לאחרים בכרטיס ובפרופיל שלך. שם הרב והקהילה גלויים למנהל המערכת בלבד."
        defaultValues={defaults}
        submitLabel="שמור שינויים"
        pendingLabel="שומר..."
        cancelHref={profileHref}
        previewIdentity={identity}
        onSubmit={onSubmit}
      />
    </Page>
  );
}
