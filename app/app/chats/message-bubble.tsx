"use client";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Reply as ReplyIcon, Pencil } from "lucide-react";
import type { Message } from "./types";

function formatMessageTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MessageBubble({
  message,
  currentUserId,
  onReply,
  onEdit,
  canEdit,
  repliedMessage,
  onJumpToReplied,
  highlighted,
  otherUserName,
  otherUserInitials,
}: {
  message: Message;
  currentUserId: string | null;
  onReply: () => void;
  onEdit: (msg: Message) => void;
  canEdit: boolean;
  repliedMessage: Message | null;
  onJumpToReplied: (id: string) => void;
  highlighted: boolean;
  otherUserName: string | null;
  otherUserInitials: string;
}) {
  const isMe = message.sender_id === currentUserId;

  return (
    <div className={cn("flex w-full", isMe ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "flex max-w-[85%] items-end gap-2",
          isMe ? "flex-row-reverse" : "flex-row",
        )}
      >
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <Card
              onDoubleClick={onReply}
              className={cn(
                "px-3 py-2 shadow-none",
                highlighted && "ring-primary/30 ring-2",
                isMe
                  ? "text-accent-foreground border-border/50 border bg-green-100"
                  : "border-border/30 border bg-slate-100",
              )}
            >
              {repliedMessage && (
                <button
                  type="button"
                  onClick={() => onJumpToReplied(repliedMessage.message_id)}
                  className="bg-background/60 mb-2 w-full rounded-md border px-2 py-1 text-left text-xs"
                >
                  <div className="text-muted-foreground mb-0.5">בתגובה ל:</div>
                  <div className="line-clamp-2 whitespace-pre-wrap">
                    {repliedMessage.content}
                  </div>
                </button>
              )}

              <div className="text-sm leading-relaxed whitespace-pre-wrap">
                {message.content}
              </div>

              <div
                className={cn(
                  "mt-1 text-[11px] opacity-70",
                  isMe ? "text-accent-foreground" : "text-muted-foreground",
                )}
              >
                {formatMessageTime(message.created_at)}
                {message.edited_at && " (נערך)"}
              </div>
            </Card>
          </ContextMenuTrigger>

          <ContextMenuContent alignOffset={4}>
            <ContextMenuItem onClick={onReply}>
              <ReplyIcon className="mr-2 h-4 w-4" />
              השב
            </ContextMenuItem>
            {canEdit && (
              <ContextMenuItem onClick={() => onEdit(message)}>
                <Pencil className="mr-2 h-4 w-4" />
                ערוך
              </ContextMenuItem>
            )}
          </ContextMenuContent>
        </ContextMenu>

        {!isMe && (
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarFallback>{otherUserInitials}</AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  );
}
