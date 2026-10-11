/** Client-safe types and limits for the shadchanim forum. */

export const FORUM_TITLE_MAX = 200;
export const FORUM_POST_MAX = 5000;
export const FORUM_REPLY_MAX = 2000;

/** כמה פוסטים בעמוד ברשימת הפורום */
export const FORUM_POSTS_PAGE_SIZE = 20;
/** תקרת בטיחות לתגובות שנטענות בעמוד פוסט; מעליה מוצגת הודעה */
export const FORUM_REPLIES_SAFETY_LIMIT = 200;

export type ForumCategory = {
  id: string;
  name: string;
  slug: string;
};

export type ForumPostSummary = {
  id: string;
  authorId: string;
  title: string;
  content: string;
  createdAt: string;
  isPinned: boolean;
  authorName: string;
  category: ForumCategory | null;
  replyCount: number;
  likeCount: number;
  isLikedByMe: boolean;
};

export type ForumReply = {
  id: string;
  authorId: string;
  content: string;
  createdAt: string;
  authorName: string;
  likeCount: number;
  isLikedByMe: boolean;
};

/** replyCount הוא הסך הכל; replies כוללות לכל היותר FORUM_REPLIES_SAFETY_LIMIT */
export type ForumPostDetail = ForumPostSummary & {
  replies: ForumReply[];
};
