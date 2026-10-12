import { z } from "zod";

import { FORUM_POST_MAX, FORUM_REPLY_MAX, FORUM_TITLE_MAX } from "./types";

/**
 * הוולידציה של תוכן הפורום: אחת ליצירה ולעריכה, כדי שעריכה לא תאפשר מה
 * שיצירה אוסרת. סכמות z.object מסירות שדות לא מוכרים (author_id, is_pinned
 * וכו'), ולכן מה שהלקוח שולח מעבר לשדות אלה לא מגיע לעדכון.
 */
export const forumPostFieldsSchema = z.object({
  title: z.string().trim().min(1).max(FORUM_TITLE_MAX),
  content: z.string().trim().min(1).max(FORUM_POST_MAX),
  categoryId: z.guid().nullish(),
});

export const forumReplyFieldsSchema = z.object({
  content: z.string().trim().min(1).max(FORUM_REPLY_MAX),
});

/** הודעות קבועות לשגיאות ולידציה */
export const FORUM_POST_INVALID_MESSAGE = "יש למלא כותרת ותוכן תקינים";
export const FORUM_REPLY_INVALID_MESSAGE = "יש לכתוב תגובה";
