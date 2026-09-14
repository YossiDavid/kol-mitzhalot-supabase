"use client";

import * as React from "react";
import { Pencil, Reply as ReplyIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { Message } from "@/app/app/chats/types";
import { formatMessageTime } from "../lib/format-time";
import { ChatAvatar } from "./chat-avatar";
import { MessageActions } from "./message-actions";

type MessageBubbleProps = {
  message: Message;
  isMe: boolean;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  canEdit: boolean;
  repliedMessage: Message | null;
  repliedAuthor: string | null;
  highlighted: boolean;
  otherUserName: string | null;
  otherAvatarUrl: string | null;
  onReply: (msg: Message) => void;
  onEdit: (msg: Message) => void;
  onJumpToReplied: (id: string) => void;
};

/**
 * פינות הבועה: בתוך קבוצה הפינות בצד השולח מתהדקות כדי שההודעות ייראו
 * רצף אחד, והפינה התחתונה של ההודעה האחרונה בקבוצה חדה — ה"זנב".
 * ההודעות שלי בצד ה-start (ימין ב-RTL), של הצד השני בצד ה-end.
 */
function bubbleCorners(
  isMe: boolean,
  isFirstInGroup: boolean,
  isLastInGroup: boolean,
): string {
  if (isMe) {
    return cn(
      "rounded-2xl",
      !isFirstInGroup && "rounded-ss-md",
      isLastInGroup ? "rounded-es-sm" : "rounded-es-md",
    );
  }
  return cn(
    "rounded-2xl",
    !isFirstInGroup && "rounded-se-md",
    isLastInGroup ? "rounded-ee-sm" : "rounded-ee-md",
  );
}

export const MessageBubble = React.memo(function MessageBubble({
  message,
  isMe,
  isFirstInGroup,
  isLastInGroup,
  canEdit,
  repliedMessage,
  repliedAuthor,
  highlighted,
  otherUserName,
  otherAvatarUrl,
  onReply,
  onEdit,
  onJumpToReplied,
}: MessageBubbleProps) {
  const reply = () => onReply(message);
  const edit = () => onEdit(message);

  const actions = (
    <MessageActions canEdit={canEdit} onReply={reply} onEdit={edit} />
  );

  const bubble = (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          onDoubleClick={reply}
          className={cn(
            "min-w-0 px-3.5 py-2 transition-shadow",
            bubbleCorners(isMe, isFirstInGroup, isLastInGroup),
            isMe
              ? "bg-primary text-primary-foreground"
              : "bg-card text-card-foreground shadow-xs",
            highlighted &&
              "ring-2 ring-ring ring-offset-2 ring-offset-background",
          )}
        >
          {repliedMessage && (
            <button
              type="button"
              onClick={() => onJumpToReplied(repliedMessage.message_id)}
              aria-label="מעבר להודעה המקורית"
              className={cn(
                "mb-1.5 block w-full rounded-lg border-s-2 px-2.5 py-1 text-start text-caption transition-colors",
                isMe
                  ? "border-primary-foreground bg-primary-foreground/15 hover:bg-primary-foreground/25"
                  : "border-primary bg-muted hover:bg-accent",
              )}
            >
              {repliedAuthor && (
                <span
                  className={cn(
                    "block font-semibold",
                    isMe ? "text-primary-foreground" : "text-primary",
                  )}
                >
                  {repliedAuthor}
                </span>
              )}
              <span
                className={cn(
                  "line-clamp-2 wrap-break-word whitespace-pre-wrap",
                  isMe ? "text-primary-foreground/85" : "text-muted-foreground",
                )}
              >
                {repliedMessage.content}
              </span>
            </button>
          )}

          <p className="text-body-sm wrap-break-word whitespace-pre-wrap">
            {message.content}
          </p>

          <div
            className={cn(
              "mt-0.5 flex items-center justify-end gap-1.5 text-caption leading-none",
              isMe ? "text-primary-foreground/75" : "text-muted-foreground",
            )}
          >
            {message.edited_at && <span>נערך</span>}
            <time dateTime={message.created_at} className="tabular-nums">
              {formatMessageTime(message.created_at)}
            </time>
          </div>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent alignOffset={4}>
        <ContextMenuItem onClick={reply}>
          <ReplyIcon className="me-2 size-4" />
          השב
        </ContextMenuItem>
        {canEdit && (
          <ContextMenuItem onClick={edit}>
            <Pencil className="me-2 size-4" />
            ערוך
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );

  return (
    // tabIndex=-1: הקשה על ההודעה (מגע) נותנת לה פוקוס וחושפת את כפתורי הפעולה
    <div
      tabIndex={-1}
      className={cn(
        "group flex w-full items-end gap-2 outline-none",
        isMe ? "justify-start" : "justify-end",
        isFirstInGroup ? "mt-3" : "mt-0.5",
      )}
    >
      <div className="flex max-w-[85%] min-w-0 items-center gap-1 md:max-w-[70%]">
        {isMe ? (
          <>
            {bubble}
            {actions}
          </>
        ) : (
          <>
            {actions}
            {bubble}
          </>
        )}
      </div>

      {/* האווטאר מוצג רק בהודעה האחרונה בקבוצה; מקום שמור שומר על יישור */}
      {!isMe && (
        <div className="size-8 shrink-0">
          {isLastInGroup && (
            <ChatAvatar
              name={otherUserName ?? ""}
              src={otherAvatarUrl}
              className="size-8"
            />
          )}
        </div>
      )}
    </div>
  );
});
