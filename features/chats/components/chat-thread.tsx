"use client";

import * as React from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createClient } from "@/lib/supabase/client";
import type { Message } from "@/app/app/chats/types";
import { buildMessageStream, canEditMessage } from "../lib/message-stream";
import { useMarkRoomRead } from "../lib/use-mark-room-read";
import { MessageBubble } from "./message-bubble";
import { ChatEmptyState } from "./chat-empty-state";
import { ChatComposer, type ComposerBanner } from "./chat-composer";
import { DateSeparator } from "./date-separator";
import { MessageListSkeleton } from "./message-list-skeleton";

const HIGHLIGHT_MS = 1200;

type ChatThreadProps = {
  roomId: string;
  currentUserId: string | null;
  /** שם הצד השני — לתוויות תגובה ולבועות */
  otherName: string | null;
  otherAvatarUrl: string | null;
  className?: string;
};

/**
 * הודעות ושדה כתיבה של חדר אחד, בלי כותרת. משמש גם את חלון הצ'אט המלא וגם
 * את שרשור ההצעה המוטמע בעמוד ההצעה — מימוש הודעות אחד לשניהם.
 */
export function ChatThread({
  roomId,
  currentUserId,
  otherName,
  otherAvatarUrl,
  className,
}: ChatThreadProps) {
  const supabase = React.useMemo(() => createClient(), []);

  const [messages, setMessages] = React.useState<Message[]>([]);
  // החדר שההודעות שלו נטענו — כל עוד אינו החדר הנוכחי, מוצג שלד
  const [loadedRoomId, setLoadedRoomId] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [replyTo, setReplyTo] = React.useState<Message | null>(null);
  const [editTarget, setEditTarget] = React.useState<Message | null>(null);
  const [highlightId, setHighlightId] = React.useState<string | null>(null);

  const messageRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const listRef = React.useRef<HTMLDivElement | null>(null);

  // Fetch messages + realtime
  React.useEffect(() => {
    if (!currentUserId) return;

    let isMounted = true;

    async function fetchMessages() {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true });
      if (!isMounted) return;
      if (error) {
        toast.error("שגיאה בטעינת ההודעות");
      } else {
        setMessages(data || []);
      }
      setLoadedRoomId(roomId);
    }

    fetchMessages();

    const channel = supabase
      .channel(`messages:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_messages",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as Message;
            setMessages((prev) => {
              if (prev.some((m) => m.message_id === row.message_id))
                return prev;
              return [...prev, row];
            });
          }
          if (payload.eventType === "UPDATE") {
            const row = payload.new as Message;
            setMessages((prev) =>
              prev.map((m) => (m.message_id === row.message_id ? row : m)),
            );
          }
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [roomId, currentUserId, supabase]);

  const isLoadingMessages = loadedRoomId !== roomId;

  // עד עכשיו last_read_at לא נכתב בשום מקום, ולכן כל שיחה נחשבה לא נקראה
  useMarkRoomRead({
    roomId,
    userId: currentUserId,
    messages,
    isReady: !isLoadingMessages,
  });

  // Auto scroll to bottom on new messages (and once the room finished loading)
  React.useEffect(() => {
    if (!messages.length || isLoadingMessages) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const viewport = listRef.current?.closest(
          '[data-slot="scroll-area-viewport"]',
        ) as HTMLElement | null;
        if (viewport) viewport.scrollTop = viewport.scrollHeight;
      });
    });
  }, [messages.length, roomId, isLoadingMessages]);

  // O(1) lookup for replied messages instead of O(N) .find() per message
  const messageById = React.useMemo(
    () => new Map(messages.map((m) => [m.message_id, m])),
    [messages],
  );

  const stream = React.useMemo(() => buildMessageStream(messages), [messages]);

  const scrollToMessage = React.useCallback((targetId: string) => {
    const el = messageRefs.current[targetId];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightId(targetId);
    setTimeout(() => setHighlightId(null), HIGHLIGHT_MS);
  }, []);

  const startEdit = React.useCallback((m: Message) => {
    setEditTarget(m);
    setReplyTo(null);
    setDraft(m.content);
  }, []);

  const startReply = React.useCallback(
    (m: Message) => {
      setReplyTo(m);
      // תגובה בזמן עריכה מבטלת את העריכה — אחרת השליחה הייתה עורכת במקום להגיב
      if (editTarget) {
        setEditTarget(null);
        setDraft("");
      }
    },
    [editTarget],
  );

  const cancelBanner = React.useCallback(() => {
    setReplyTo(null);
    if (editTarget) setDraft("");
    setEditTarget(null);
  }, [editTarget]);

  async function onSend() {
    if (editTarget) {
      await submitEdit();
      return;
    }
    const text = draft.trim();
    if (!text || !currentUserId || sending) return;

    setSending(true);
    const content = text;
    setDraft("");

    try {
      const { error } = await supabase.from("chat_messages").insert({
        room_id: roomId,
        sender_id: currentUserId,
        content,
        reply_to_message_id: replyTo?.message_id ?? null,
      });

      if (error) {
        toast.error("שגיאה בשליחת ההודעה");
        setDraft(content);
      }
    } catch {
      toast.error("שגיאה בשליחת ההודעה");
      setDraft(content);
    } finally {
      setSending(false);
      setReplyTo(null);
    }
  }

  async function submitEdit() {
    if (!editTarget || !currentUserId || sending) return;
    if (!canEditMessage(editTarget, currentUserId)) {
      toast.error("אפשר לערוך רק עד 7 דקות משליחת ההודעה");
      setEditTarget(null);
      return;
    }
    const text = draft.trim();
    if (!text) return;

    setSending(true);
    try {
      const { error } = await supabase
        .from("chat_messages")
        .update({ content: text, edited_at: new Date().toISOString() })
        .eq("message_id", editTarget.message_id);

      if (error) {
        toast.error("שגיאה בעריכת ההודעה");
        return;
      }
      setEditTarget(null);
      setDraft("");
    } finally {
      setSending(false);
    }
  }

  const authorLabel = (m: Message) =>
    m.sender_id === currentUserId ? "את/ה" : (otherName ?? "");

  const banner: ComposerBanner | null = editTarget
    ? {
        kind: "edit",
        messageId: editTarget.message_id,
        title: "עריכת הודעה",
        content: editTarget.content,
      }
    : replyTo
      ? {
          kind: "reply",
          messageId: replyTo.message_id,
          title:
            replyTo.sender_id === currentUserId
              ? "תגובה להודעה שלך"
              : `תגובה ל${otherName ?? "הודעה"}`,
          content: replyTo.content,
        }
      : null;

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <ScrollArea className="min-h-0 flex-1 bg-background">
        <div
          ref={listRef}
          role="log"
          aria-label="הודעות"
          className="flex flex-col px-3 py-4 md:px-6"
        >
          {isLoadingMessages ? (
            <MessageListSkeleton />
          ) : messages.length === 0 ? (
            <ChatEmptyState variant="no-messages" className="py-16" />
          ) : (
            stream.map((item) => {
              if (item.kind === "day") {
                return <DateSeparator key={item.key} label={item.label} />;
              }
              const m = item.message;
              const replied = m.reply_to_message_id
                ? (messageById.get(m.reply_to_message_id) ?? null)
                : null;
              return (
                <div
                  key={item.key}
                  ref={(node) => {
                    messageRefs.current[m.message_id] = node;
                  }}
                >
                  <MessageBubble
                    message={m}
                    isMe={m.sender_id === currentUserId}
                    isFirstInGroup={item.isFirstInGroup}
                    isLastInGroup={item.isLastInGroup}
                    canEdit={canEditMessage(m, currentUserId)}
                    repliedMessage={replied}
                    repliedAuthor={replied ? authorLabel(replied) : null}
                    highlighted={highlightId === m.message_id}
                    otherUserName={otherName}
                    otherAvatarUrl={otherAvatarUrl}
                    onReply={startReply}
                    onEdit={startEdit}
                    onJumpToReplied={scrollToMessage}
                  />
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      <ChatComposer
        value={draft}
        onChange={setDraft}
        onSubmit={() => void onSend()}
        onCancelBanner={cancelBanner}
        isSending={sending}
        banner={banner}
      />
    </div>
  );
}
