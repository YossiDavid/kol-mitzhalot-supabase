import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { Page, PageHeader } from "@/components/layout";
import { CardSkeleton } from "@/components/ui/card-skeleton";
import { SkeletonRegion } from "@/components/ui/skeleton";
import { AdminShadchanProfileEditForm } from "@/features/shadchanim/components/admin-shadchan-profile-edit-form";
import {
  rowToForm,
  SHADCHAN_PROFILE_SELECT,
} from "@/features/shadchanim/lib/profile-form";
import {
  identityFromUser,
  type PreviewIdentity,
} from "@/features/shadchanim/lib/preview-card";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatFullName } from "@/lib/user-display-name";

/** מספר שדות הטופס, לשלד הטעינה. */
const FORM_FIELD_COUNT = 7;

const idSchema = z.guid();

async function EditContent({ params }: { params: Promise<{ id: string }> }) {
  noStore();
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();

  const supabase = await createClient();
  // RLS: רק מנהל קורא שורה של אחר; לשאר התוצאה ריקה והעמוד נותן 404
  const [{ data: row }, { data: profile }] = await Promise.all([
    supabase
      .from("shadchanim_info")
      .select(SHADCHAN_PROFILE_SELECT)
      .eq("user_id", id)
      .maybeSingle(),
    supabase
      .from("user_profiles")
      .select("first_name, last_name")
      .eq("id", id)
      .maybeSingle(),
  ]);

  if (!row) notFound();

  // רק אחרי שהשורה נקראה (כלומר: מנהל), שליפת המשתמש עם הרשאות שירות
  const authResult = await createAdminClient().auth.admin.getUserById(id);

  // אותו מקור שם כמו ברשימת השדכנים: user_profiles, ואז ה-metadata של המשתמש
  const authUser = authResult.data.user;
  const identity: PreviewIdentity = authUser
    ? identityFromUser(authUser, profile)
    : {
        id,
        firstName: profile?.first_name ?? null,
        lastName: profile?.last_name ?? null,
        avatarUrl: null,
      };
  const name = formatFullName(identity.firstName, identity.lastName);

  return (
    <Page width="form-aside">
      <PageHeader
        title="עריכת פרופיל שדכן"
        description={name || "עריכת פרטי השדכן"}
      />
      <AdminShadchanProfileEditForm
        userId={id}
        defaults={rowToForm(row)}
        identity={identity}
      />
    </Page>
  );
}

function EditFallback() {
  return (
    <Page width="form-aside">
      <PageHeader title="עריכת פרופיל שדכן" description="טוען…" />
      <SkeletonRegion>
        <CardSkeleton fields={FORM_FIELD_COUNT} footer />
      </SkeletonRegion>
    </Page>
  );
}

/** עריכת פרופיל שדכן בידי מנהל; [id] הוא מזהה המשתמש של השדכן. */
export default function AdminShadchanEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<EditFallback />}>
      <EditContent params={params} />
    </Suspense>
  );
}
