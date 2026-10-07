/** Client-safe types and limits for the shadchanim forum. */

export const FORUM_TITLE_MAX = 200;
export const FORUM_POST_MAX = 5000;
export const FORUM_REPLY_MAX = 2000;

export type ForumCategory = {
  id: string;
  name: string;
  slug: string;
};

export type ForumPostSummary = {
  id: string;
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
  content: string;
  createdAt: string;
  authorName: string;
  likeCount: number;
  isLikedByMe: boolean;
};

export type ForumPostDetail = Omit<ForumPostSummary, "replyCount"> & {
  replies: ForumReply[];
};
