"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ShadchanProfileFormCard } from "@/features/shadchanim/components/shadchan-profile-form-card";
import type { PreviewIdentity } from "@/features/shadchanim/lib/preview-card";
import type { ShadchanFormData } from "@/features/shadchanim/lib/profile-form";

const UPDATE_PROFILE_ENDPOINT = "/api/v1/admin/shadchanim/update-profile";
const SAVE_ERROR_MESSAGE = "שמירת הפרופיל נכשלה, נסו שוב";
const FORBIDDEN_MESSAGE = "אין הרשאה לערוך את הפרופיל";
const FORBIDDEN_STATUSES = [401, 403];

interface AdminShadchanProfileEditFormProps {
  userId: string;
  defaults: ShadchanFormData;
  identity: PreviewIdentity;
}

/** עריכת פרופיל שדכן בידי מנהל, דרך נתיב השרת שמוודא הרשאת מנהל. */
export function AdminShadchanProfileEditForm({
  userId,
  defaults,
  identity,
}: AdminShadchanProfileEditFormProps) {
  const router = useRouter();

  const onSubmit = async (data: ShadchanFormData) => {
    try {
      const response = await fetch(UPDATE_PROFILE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...data }),
      });

      if (!response.ok) {
        toast.error(
          FORBIDDEN_STATUSES.includes(response.status)
            ? FORBIDDEN_MESSAGE
            : SAVE_ERROR_MESSAGE,
        );
        return;
      }

      toast.success("הפרופיל עודכן בהצלחה");
      router.push("/app/admin/shadchanim");
      router.refresh();
    } catch (error: unknown) {
      toast.error(SAVE_ERROR_MESSAGE);
      console.error("Error updating shadchan profile (admin):", error);
    }
  };

  return (
    <ShadchanProfileFormCard
      title="פרטי הפרופיל"
      description="עריכת הטקסטים שמוצגים בפרופיל השדכן. אישור ודחייה של בקשה נעשים בעמוד הבקשות."
      defaultValues={defaults}
      submitLabel="שמור שינויים"
      pendingLabel="שומר..."
      cancelHref="/app/admin/shadchanim"
      previewIdentity={identity}
      showApplicationNote
      onSubmit={onSubmit}
    />
  );
}
