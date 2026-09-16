import { z } from "zod";

import { requiredText } from "@/lib/forms/schema";

/** ערך במאגר החסידויות והקהילות (public.communities) */
export type Community = {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
};

/**
 * ערך מהמאגר יחד עם מספר הכרטיסים שמשתמשים בו בפועל. הערך נשמר בכרטיס
 * כטקסט חופשי ולא כמפתח זר, ולכן השימוש נספר בהשוואת שם ולא בקשר במסד.
 */
export type CommunityRow = Community & {
  /** כרטיסי מיועדים חיים שבהם students.community הוא השם הזה */
  studentsCount: number;
  /** שורות השכלה (education_history.community) שבהן מופיע השם */
  educationCount: number;
  /** הסכום - המספר שעליו נשענת חסימת המחיקה */
  usageCount: number;
};

/** אותה מגבלה כמו CHECK communities_name_not_blank במסד */
export const COMMUNITY_NAME_MAX_LENGTH = 60;

export const communitySchema = z.object({
  name: requiredText("שם החסידות או הקהילה").max(
    COMMUNITY_NAME_MAX_LENGTH,
    `עד ${COMMUNITY_NAME_MAX_LENGTH} תווים`,
  ),
  is_active: z.boolean(),
});

export type CommunityFormState = z.infer<typeof communitySchema>;

export const EMPTY_COMMUNITY_FORM: CommunityFormState = {
  name: "",
  is_active: true,
};
