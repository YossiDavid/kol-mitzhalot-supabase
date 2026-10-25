"use client";

import * as React from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createClient } from "@/lib/supabase/client";
import type { Message } from "@/app/app/chats/types";
import { buildMessageStream, canEditMessage } from "../lib/message-stream";
import { useChatMessages } from "../lib/use-chat-messages";
import { useMarkRoomRead } from "../lib/use-mark-room-read";
import { MessageBubble } from "./message-bubble";
import { ChatEmptyState } from "./chat-empty-state";
import { ChatComposer, type ComposerBanner } from "./chat-composer";
import { DateSeparator } from "./date-separator";
import { MessageListSkeleton } from "./message-list-skeleton";

const HIGHLIGHT_MS = 1200;

/** הודעה מובנת לפי קוד השגיאה של Postgres/PostgREST, כדי שהמשתמש ידע מה לעשות */
function sendErrorMessage(code: string | undefined): string {
  // 42501 = חסימת RLS: החיבור פג או שהמשתמש אינו משתתף בשיחה
  if (code === "42501") {
    return "אין הרשאה לשלוח בשיחה זו. רעננו את הדף או התחברו מחדש";
  }
  if (code === "PGRST301" || code === "401") {
    return "החיבור פג. התחברו מחדש ונסו שוב";
  }
  return "שגיאה בשליחת ההודעה";
}

type ChatThreadProps = {
  roomId: string;
  currentUserId: string | null;
  /** שם הצד השני — לתוויות תגובה ולבועות */
  otherName: string | null;
  otherAvatarUrl: string | null;
  className?: string;
  /** פוקוס על שדה הכתיבה בפתיחה */
  shouldFocusComposer?: boolean;
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
  shouldFocusComposer = false,
}: ChatThreadProps) {
  const supabase = React.useMemo(() => createClient(), []);

  const {
    messages,
    isLoading: isLoadingMessages,
    hasOlder,
    isLoadingOlder,
    olderLoads,
    loadOlder,
  } = useChatMessages(roomId, currentUserId);
  const [sending, setSending] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [replyTo, setReplyTo] = React.useState<Message | null>(null);
  const [editTarget, setEditTarget] = React.useState<Message | null>(null);
  const [highlightId, setHighlightId] = React.useState<string | null>(null);

  const messageRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const listRef = React.useRef<HTMLDivElement | null>(null);
  /** גובה וגלילה לפני שהודעות ישנות נוספו בראש, לשימור מקום הקריאה */
  const olderAnchorRef = React.useRef<{ height: number; top: number } | null>(
    null,
  );

  const getViewport = React.useCallback(
    () =>
      listRef.current?.closest(
        '[data-slot="scroll-area-viewport"]',
      ) as HTMLElement | null,
    [],
  );

  // עד עכשיו last_read_at לא נכתב בשום מקום, ולכן כל שיחה נחשבה לא נקראה
  useMarkRoomRead({
    roomId,
    userId: currentUserId,
    messages,
    isReady: !isLoadingMessages,
  });

  // גלילה לתחתית בהודעה חדשה (ובסיום טעינת החדר). לפי ההודעה האחרונה ולא לפי
  // מספר ההודעות: הודעות ישנות שנוספו בראש לא צריכות להקפיץ למטה
  const lastMessageId = messages.at(-1)?.message_id ?? null;
  React.useEffect(() => {
    if (!lastMessageId || isLoadingMessages) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const viewport = getViewport();
        if (viewport) viewport.scrollTop = viewport.scrollHeight;
      });
    });
  }, [lastMessageId, roomId, isLoadingMessages, getViewport]);

  // הודעות ישנות נוספו בראש: הקורא נשאר באותה הודעה במקום להיזרק למעלה
  React.useLayoutEffect(() => {
    const anchor = olderAnchorRef.current;
    const viewport = getViewport();
    if (!anchor || !viewport || olderLoads === 0) return;
    olderAnchorRef.current = null;
    viewport.scrollTop = anchor.top + (viewport.scrollHeight - anchor.height);
  }, [olderLoads, getViewport]);

  const handleLoadOlder = React.useCallback(() => {
    const viewport = getViewport();
    olderAnchorRef.current = viewport
      ? { height: viewport.scrollHeight, top: viewport.scrollTop }
      : null;
    void loadOlder();
  }, [getViewport, loadOlder]);

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
        console.error("[chats/send]", error.code, error.message);
        toast.error(sendErrorMessage(error.code));
        setDraft(content);
      }
    } catch (err) {
      console.error("[chats/send]", err);
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
            <>
              {hasOlder && (
                <div className="mb-3 flex justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isLoadingOlder}
                    onClick={handleLoadOlder}
                  >
                    {isLoadingOlder ? "טוען…" : "טעינת הודעות קודמות"}
                  </Button>
                </div>
              )}
              {stream.map((item) => {
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
              })}
            </>
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
        shouldAutoFocus={shouldFocusComposer}
      />
    </div>
  );
}
