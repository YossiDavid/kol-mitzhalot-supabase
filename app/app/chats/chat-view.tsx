"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Box } from "@/components/layout";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { MessageBubble } from "./message-bubble";
import type { Message } from "./types";

function canEditMessage(m: Message, uid: string | null): boolean {
  if (!uid || m.sender_id !== uid) return false;
  return Date.now() - new Date(m.created_at).getTime() <= 7 * 60 * 1000;
}

function getInitials(name: string): string {
  const words = name.split(" ").filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0][0]?.toUpperCase() ?? "?";
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function ChatView({ roomId }: { roomId: string }) {
  const supabase = createClient();

  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
  const [roomTitle, setRoomTitle] = React.useState<string | null>(null);
  const [otherUserInitials, setOtherUserInitials] = React.useState("?");
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [sending, setSending] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [otherOnline, setOtherOnline] = React.useState(false);
  const [replyTo, setReplyTo] = React.useState<Message | null>(null);
  const [editTarget, setEditTarget] = React.useState<Message | null>(null);
  const [highlightId, setHighlightId] = React.useState<string | null>(null);

  const messageRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const listRef = React.useRef<HTMLDivElement | null>(null);
  // Stable ref for otherUserId — avoids tearing down the presence channel on async updates
  const otherUserIdRef = React.useRef<string | null>(null);

  // Fetch user + room details in one pass — no extra render cycle / waterfall
  React.useEffect(() => {
    let isMounted = true;

    async function init() {
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData.user?.id ?? null;
      if (!isMounted || !uid) return;
      setCurrentUserId(uid);

      const { data: room } = await supabase
        .from("chat_rooms")
        .select("*")
        .eq("room_id", roomId)
        .single();

      if (!room || !isMounted) return;

      const otherId = room.user_a === uid ? room.user_b : room.user_a;
      otherUserIdRef.current = otherId;

      try {
        const { data: userData } = await supabase.rpc("get_user_metadata", {
          target_user_id: otherId,
        });

        let name = otherId.substring(0, 8);
        if (userData?.firstName || userData?.lastName) {
          name = `${userData.firstName || ""} ${userData.lastName || ""}`.trim();
        } else if (userData?.email) {
          name = userData.email.split("@")[0];
        }

        if (!isMounted) return;
        setRoomTitle(name);
        setOtherUserInitials(getInitials(name));
      } catch {
        if (!isMounted) return;
        setRoomTitle(otherId.substring(0, 8));
        setOtherUserInitials(otherId[0]?.toUpperCase() ?? "?");
      }
    }

    void init();
    return () => {
      isMounted = false;
    };
  }, [roomId, supabase]);

  // Fetch messages + realtime + presence
  // otherUserId removed from deps — read via ref to avoid channel teardown
  React.useEffect(() => {
    if (!currentUserId) return;

    let isMounted = true;

    async function fetchMessages() {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true });
      if (!error && isMounted) setMessages(data || []);
    }

    fetchMessages();

    const channel = supabase.channel(`room:${roomId}`, {
      config: { presence: { key: currentUserId } },
    });

    const syncPresence = () => {
      const state = channel.presenceState() as Record<
        string,
        Array<{ user_id: string }>
      >;
      const onlineIds = new Set<string>();
      Object.values(state).forEach((arr) =>
        arr.forEach((p) => onlineIds.add(p.user_id)),
      );
      setOtherOnline(
        Boolean(otherUserIdRef.current && onlineIds.has(otherUserIdRef.current)),
      );
    };

    channel
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
              if (prev.some((m) => m.message_id === row.message_id)) return prev;
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
      .on("presence", { event: "sync" }, syncPresence)
      .on("presence", { event: "join" }, syncPresence)
      .on("presence", { event: "leave" }, syncPresence);

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ user_id: currentUserId });
        syncPresence();
      }
    });

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [roomId, currentUserId, supabase]);

  // Auto scroll to bottom on new messages
  React.useEffect(() => {
    if (!messages.length) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = listRef.current;
        if (!el) return;
        const viewport = el.closest(
          '[data-slot="scroll-area-viewport"]',
        ) as HTMLElement;
        if (viewport) {
          viewport.scrollTop = viewport.scrollHeight;
        } else {
          let parent = el.parentElement;
          while (parent) {
            if (parent.scrollHeight > parent.clientHeight) {
              parent.scrollTop = parent.scrollHeight;
              break;
            }
            parent = parent.parentElement;
          }
        }
      });
    });
  }, [messages.length, roomId]);

  // O(1) lookup for replied messages instead of O(N) .find() per message
  const messageById = React.useMemo(
    () => new Map(messages.map((m) => [m.message_id, m])),
    [messages],
  );

  const scrollToMessage = React.useCallback((targetId: string) => {
    const el = messageRefs.current[targetId];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightId(targetId);
    setTimeout(() => setHighlightId(null), 1200);
  }, []);

  const startEdit = React.useCallback((m: Message) => {
    setEditTarget(m);
    setReplyTo(null);
    setDraft(m.content);
  }, []);

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
    if (!editTarget || !currentUserId) return;
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

  return (
    <Box asChild className="my-4">
      <main className="flex h-[calc(100%-2rem)] flex-col">
        {/* Header */}
        <div className="flex h-14 shrink-0 items-center gap-3 px-4">
          <Link
            href="/app/chats"
            className={cn(
              "text-muted-foreground hover:text-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition md:hidden",
            )}
          >
            <ArrowRight className="h-5 w-5" />
          </Link>
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarFallback>{otherUserInitials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-semibold">
              {roomTitle ?? "..."}
            </div>
            <div className="text-muted-foreground text-xs">
              {otherOnline ? "מחובר" : "לא מחובר"}
            </div>
          </div>
        </div>
        <Separator />

        {/* Messages */}
        <ScrollArea className="max-h-[calc(100vh-20rem)] flex-1">
          <div ref={listRef}>
            <div className="mx-auto flex w-full flex-col gap-3 p-4">
              {messages.length === 0 ? (
                <div className="text-muted-foreground flex items-center justify-center py-8">
                  אין הודעות עדיין
                </div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.message_id}
                    ref={(node) => {
                      messageRefs.current[m.message_id] = node;
                    }}
                  >
                    <MessageBubble
                      message={m}
                      currentUserId={currentUserId}
                      onReply={() => setReplyTo(m)}
                      onEdit={startEdit}
                      canEdit={canEditMessage(m, currentUserId)}
                      repliedMessage={
                        m.reply_to_message_id
                          ? (messageById.get(m.reply_to_message_id) ?? null)
                          : null
                      }
                      onJumpToReplied={scrollToMessage}
                      highlighted={highlightId === m.message_id}
                      otherUserName={roomTitle}
                      otherUserInitials={otherUserInitials}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        </ScrollArea>

        <Separator />

        {/* Reply / Edit banner */}
        {(replyTo || editTarget) && (
          <div className="bg-muted/40 mx-3 mt-2 rounded-md border px-3 py-2 text-xs">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-muted-foreground mb-1">
                  {replyTo ? "תגובה להודעה" : "עריכת הודעה"}
                </div>
                <div className="truncate">
                  {replyTo ? replyTo.content : editTarget?.content}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setReplyTo(null);
                  if (editTarget) setDraft("");
                  setEditTarget(null);
                }}
                className="h-7 px-2"
              >
                ביטול
              </Button>
            </div>
          </div>
        )}

        {/* Composer */}
        <div className="p-3">
          <div className="flex w-full items-end gap-2">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="כתוב הודעה..."
              disabled={sending}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void onSend();
                }
              }}
            />
            <Button onClick={() => void onSend()} disabled={sending}>
              {sending ? "שולח..." : editTarget ? "שמור" : "שלח"}
            </Button>
          </div>
        </div>
      </main>
    </Box>
  );
}
