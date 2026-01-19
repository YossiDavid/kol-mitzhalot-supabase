"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { Box } from "@/components/layout";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Reply as ReplyIcon, Pencil } from "lucide-react";

type Room = {
  room_id: string;
  title: string;
  lastMessage: string | null;
  lastAt: string | null;
  other_user_id: string;
  other_user_name: string;
};

type Message = {
  message_id: string;
  room_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  edited_at: string | null;
  reply_to_message_id: string | null; // ✅ חדש
};

export default function ChatPage() {
  const router = useRouter();
  const search = useSearchParams();
  const supabase = createClient();

  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
  const [rooms, setRooms] = React.useState<Room[]>([]);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [otherOnline, setOtherOnline] = React.useState<boolean>(false);
  const [replyTo, setReplyTo] = React.useState<Message | null>(null);
  const [editTarget, setEditTarget] = React.useState<Message | null>(null);

  const messageRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const [highlightId, setHighlightId] = React.useState<string | null>(null);

  function scrollToMessage(targetId: string) {
    const el = messageRefs.current[targetId];
    if (!el) return;

    el.scrollIntoView({ behavior: "smooth", block: "center" });

    setHighlightId(targetId);
    window.clearTimeout((scrollToMessage as any)._t);
    (scrollToMessage as any)._t = window.setTimeout(() => {
      setHighlightId(null);
    }, 1200);
  }

  const roomId = search.get("room") ?? null;

  const room = React.useMemo(
    () => rooms.find((r) => r.room_id === roomId) ?? null,
    [roomId, rooms],
  );

  const otherUserName = room?.other_user_name ?? room?.title ?? null;

  const otherUserInitials = React.useMemo(() => {
    if (!otherUserName) return "?";
    const words = otherUserName.split(" ").filter(Boolean);
    if (words.length === 0) return "?";
    if (words.length === 1) return words[0][0]?.toUpperCase() ?? "?";
    return (words[0][0] + words[1][0]).toUpperCase();
  }, [otherUserName]);

  const listRef = React.useRef<HTMLDivElement | null>(null);

  // Get current user
  React.useEffect(() => {
    async function getUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);
    }
    getUser();
  }, [supabase]);

  // Fetch rooms for current user
  React.useEffect(() => {
    if (!currentUserId) return;

    async function fetchRooms() {
      setLoading(true);
      try {
        // Get all rooms where user is a participant
        const { data: participants, error: participantsError } = await supabase
          .from("chat_room_participants")
          .select("room_id, joined_at")
          .eq("user_id", currentUserId)
          .is("deleted_before", null);

        if (participantsError) {
          console.error("Error fetching participants:", participantsError);
          setLoading(false);
          return;
        }

        if (!participants || participants.length === 0) {
          setRooms([]);
          setLoading(false);
          return;
        }

        const roomIds = participants.map((p) => p.room_id);

        // Get room details and last message
        const { data: roomsData, error: roomsError } = await supabase
          .from("chat_rooms")
          .select("*")
          .in("room_id", roomIds)
          .order("last_message_at", { ascending: false, nullsFirst: false });

        if (roomsError) {
          console.error("Error fetching rooms:", roomsError);
          setLoading(false);
          return;
        }

        // For each room, get the other participant and last message
        const roomsWithDetails: Room[] = await Promise.all(
          (roomsData || []).map(async (room) => {
            // Determine the other user (user_a or user_b that's not current user)
            const otherUserId =
              room.user_a === currentUserId ? room.user_b : room.user_a;

            // Get other user's name from user_metadata using RPC function
            let otherUserName = "Unknown User";
            try {
              const { data: userData, error: rpcError } = await supabase.rpc(
                "get_user_metadata",
                {
                  target_user_id: otherUserId,
                },
              );

              if (!rpcError && userData) {
                if (userData.firstName || userData.lastName) {
                  otherUserName = `${userData.firstName || ""} ${
                    userData.lastName || ""
                  }`.trim();
                } else if (userData.email) {
                  // Fallback to email if no name available
                  otherUserName = userData.email.split("@")[0];
                }
              }
            } catch (e) {
              // Fallback to user ID if we can't get name
              console.error("Error fetching user name:", e);
              otherUserName = otherUserId.substring(0, 8);
            }

            // Get last message
            let lastMessage: string | null = null;
            let lastAt: string | null = null;

            if (room.last_message_id) {
              const { data: lastMsg } = await supabase
                .from("chat_messages")
                .select("content, created_at")
                .eq("message_id", room.last_message_id)
                .single();

              if (lastMsg) {
                lastMessage = lastMsg.content;
                lastAt = formatTime(lastMsg.created_at);
              }
            }

            return {
              room_id: room.room_id,
              title: otherUserName,
              lastMessage,
              lastAt,
              other_user_id: otherUserId,
              other_user_name: otherUserName,
            };
          }),
        );

        setRooms(roomsWithDetails);
      } catch (error) {
        console.error("Error fetching rooms:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchRooms();
  }, [currentUserId, supabase]);

  // Realtime rooms updates (sidebar online refresh)
  React.useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel(`rooms:${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_rooms",
        },
        async (payload) => {
          const updated = payload.new as any; // chat_rooms row
          if (!updated?.room_id) return;

          // If this room isn't in our list, ignore (RLS should already filter, but keep it safe)
          const exists = rooms.some((r) => r.room_id === updated.room_id);
          if (!exists) return;

          // Fetch last message content/time (if last_message_id exists)
          let lastMessage: string | null = null;
          let lastAt: string | null = null;

          if (updated.last_message_id) {
            const { data: lastMsg, error } = await supabase
              .from("chat_messages")
              .select("content, created_at")
              .eq("message_id", updated.last_message_id)
              .maybeSingle();

            if (!error && lastMsg) {
              lastMessage = lastMsg.content;
              lastAt = formatTime(lastMsg.created_at);
            }
          }

          setRooms((prev) => {
            const next = prev.map((r) =>
              r.room_id === updated.room_id
                ? {
                    ...r,
                    lastMessage: lastMessage ?? r.lastMessage,
                    lastAt: lastAt ?? r.lastAt,
                  }
                : r,
            );

            // Sort by latest (basic: nulls last)
            next.sort((a, b) => {
              const aT = a.lastAt ? 1 : 0;
              const bT = b.lastAt ? 1 : 0;
              return bT - aT;
            });

            return next;
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, supabase, rooms]);

  // Fetch messages for selected room + realtime updates + presence (online/offline)
  React.useEffect(() => {
    if (!roomId || !currentUserId) {
      setMessages([]);
      setOtherOnline(false);
      return;
    }

    let isMounted = true;

    async function fetchMessages() {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching messages:", error);
        return;
      }

      if (isMounted) setMessages(data || []);
    }

    fetchMessages();

    // One channel for BOTH: postgres changes + presence
    const channel = supabase.channel(`room:${roomId}`, {
      config: {
        presence: { key: currentUserId }, // stable key per user
      },
    });

    const syncPresence = () => {
      // Presence state format: { [key]: [{ user_id: ... }, ...] }
      const state = channel.presenceState() as Record<
        string,
        Array<{ user_id: string }>
      >;

      const onlineIds = new Set<string>();
      Object.values(state).forEach((arr) => {
        arr.forEach((p) => onlineIds.add(p.user_id));
      });

      const otherId = room?.other_user_id; // from rooms list
      setOtherOnline(Boolean(otherId && onlineIds.has(otherId)));
    };

    channel
      .on(
        "postgres_changes",
        {
          event: "*", // ✅ היה INSERT בלבד
          schema: "public",
          table: "chat_messages",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as Message;
            setMessages((prev) => {
              const exists = prev.some((m) => m.message_id === row.message_id);
              if (exists) return prev;
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
      // presence events
      .on("presence", { event: "sync" }, syncPresence)
      .on("presence", { event: "join" }, syncPresence)
      .on("presence", { event: "leave" }, syncPresence);

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        // announce I'm online in this room
        await channel.track({ user_id: currentUserId });
        syncPresence();
      }
    });

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [roomId, currentUserId, supabase, room?.other_user_id]);

  // Auto scroll to bottom on messages change or initial load
  React.useEffect(() => {
    if (messages.length === 0) return;

    // Use double requestAnimationFrame to ensure DOM is updated
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = listRef.current;
        if (!el) return;

        // Find the ScrollArea viewport (parent of our div)
        // The viewport is the scrollable container from Radix UI
        const viewport = el.closest(
          '[data-slot="scroll-area-viewport"]',
        ) as HTMLElement;

        if (viewport) {
          // Scroll to bottom of viewport
          viewport.scrollTop = viewport.scrollHeight;
        } else {
          // Fallback: try to find any scrollable parent
          let scrollableParent = el.parentElement;
          while (scrollableParent) {
            if (scrollableParent.scrollHeight > scrollableParent.clientHeight) {
              scrollableParent.scrollTop = scrollableParent.scrollHeight;
              break;
            }
            scrollableParent = scrollableParent.parentElement;
          }
        }
      });
    });
  }, [messages.length, roomId]); // Also trigger when room changes

  function selectRoom(id: string) {
    router.push(`/app/chats?room=${id}`);
  }

  async function onSend() {
    if (editTarget) {
      await submitEdit();
      return;
    }
    const text = draft.trim();
    if (!text || !roomId || !currentUserId || sending) return;

    setSending(true);
    const messageContent = text;
    setDraft(""); // Clear draft immediately for better UX

    try {
      const { data, error } = await supabase
        .from("chat_messages")
        .insert({
          room_id: roomId,
          sender_id: currentUserId,
          content: messageContent,
          reply_to_message_id: replyTo?.message_id ?? null,
        })

        .select()
        .single();
      if (error) {
        console.error("Error sending message:", error);
        alert("שגיאה בשליחת ההודעה");
        setDraft(messageContent); // Restore draft on error
      }
      // else if (data) {
      //   // Add message to state immediately (optimistic update)
      //   // The subscription will also add it, but this ensures it appears instantly
      //   setMessages((prev) => {
      //     // Check if message already exists (from subscription)
      //     const exists = prev.some((m) => m.message_id === data.message_id);
      //     if (exists) return prev;
      //     return [...prev, data as Message];
      //   });
      // }
    } catch (error) {
      console.error("Error sending message:", error);
      alert("שגיאה בשליחת ההודעה");
      setDraft(messageContent); // Restore draft on error
    } finally {
      setSending(false);
      setReplyTo(null);
    }
  }

  function formatTime(dateString: string | null): string {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString("he-IL", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (diffDays < 7) {
      return `${diffDays} ימים`;
    } else {
      return date.toLocaleDateString("he-IL", {
        day: "2-digit",
        month: "2-digit",
      });
    }
  }

  function canEditMessage(m: Message, uid: string | null) {
    if (!uid) return false;
    if (m.sender_id !== uid) return false;

    const created = new Date(m.created_at).getTime();
    const now = Date.now();
    const sevenMin = 7 * 60 * 1000;

    return now - created <= sevenMin;
  }

  function startEdit(m: Message) {
    setEditTarget(m);
    setReplyTo(null);
    setDraft(m.content);
  }

  async function submitEdit() {
    if (!editTarget || !roomId || !currentUserId) return;

    // enforce client-side too
    if (!canEditMessage(editTarget, currentUserId)) {
      alert("אפשר לערוך רק עד 7 דקות משליחת ההודעה");
      setEditTarget(null);
      return;
    }

    const text = draft.trim();
    if (!text) return;

    setSending(true);
    try {
      const { error } = await supabase
        .from("chat_messages")
        .update({
          content: text,
          edited_at: new Date().toISOString(),
        })
        .eq("message_id", editTarget.message_id);

      if (error) {
        console.error(error);
        alert("שגיאה בעריכת ההודעה");
        return;
      }

      setEditTarget(null);
      setDraft("");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="h-full flex-1">
      <div className="grid h-full grid-cols-1 md:grid-cols-[340px_1fr]">
        {/* Sidebar */}
        <Box
          asChild
          className="my-4 rounded-l-none p-0 inset-shadow-[10px_0_10px_-10px_rgba(0,0,0,0.1)]"
        >
          <aside className="">
            <div className="flex h-14 items-center justify-between px-4">
              <div className="text-sm font-semibold">צ׳אטים</div>
            </div>
            <Separator />
            <ScrollArea className="h-[calc(100%-56px)]">
              <div className="">
                {loading ? (
                  <div className="text-muted-foreground p-4 text-center text-sm">
                    טוען...
                  </div>
                ) : rooms.length === 0 ? (
                  <div className="text-muted-foreground p-4 text-center text-sm">
                    אין צ'אטים
                  </div>
                ) : (
                  rooms.map((r) => {
                    const active = r.room_id === roomId;
                    return (
                      <button
                        key={r.room_id}
                        onClick={() => selectRoom(r.room_id)}
                        className={cn(
                          "flex w-full items-center gap-3 px-4 py-4 text-left transition",
                          active ? "bg-slate-100" : "hover:bg-muted/60",
                        )}
                      >
                        <Avatar className="size-9">
                          <AvatarFallback>
                            {r.title
                              .split(" ")
                              .slice(0, 2)
                              .map((w) => w[0])
                              .join("")
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="truncate text-sm font-medium">
                              {r.title}
                            </div>
                            {r.lastAt && (
                              <div className="text-muted-foreground shrink-0 text-xs">
                                {r.lastAt}
                              </div>
                            )}
                          </div>
                          {r.lastMessage && (
                            <div className="text-muted-foreground truncate text-xs">
                              {r.lastMessage.length > 50
                                ? `${r.lastMessage.substring(0, 50)}...`
                                : r.lastMessage}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </aside>
        </Box>

        {/* Chat */}
        <Box asChild className="">
          <main className="flex h-full flex-col">
            {/* Header */}
            <div className="flex h-14 items-center justify-between px-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback>
                    {room?.title
                      ?.split(" ")
                      .slice(0, 2)
                      .map((w) => w[0])
                      .join("")
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="leading-tight">
                  <div className="text-sm font-semibold">
                    {room?.title ?? "בחר צ'אט"}
                  </div>

                  {roomId && room ? (
                    <div className="text-muted-foreground text-xs">
                      {otherOnline ? "מחובר" : "לא מחובר"}
                    </div>
                  ) : null}
                </div>
              </div>
              {/* Optional actions (kept minimal) */}
              {/* <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/">Back</Link>
                </Button>
              </div> */}
            </div>
            <Separator />
            {/* Messages */}
            <ScrollArea className="max-h-[calc(100vh-20rem)] flex-1">
              <div ref={listRef} className="h-full">
                <div className="mx-auto flex w-full flex-col gap-3 p-4">
                  {!roomId ? (
                    <div className="text-muted-foreground flex h-full items-center justify-center">
                      בחר צ'אט מהרשימה
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-muted-foreground flex h-full items-center justify-center">
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
                          key={m.message_id}
                          message={m}
                          currentUserId={currentUserId}
                          onReply={() => setReplyTo(m)}
                          onEdit={(msg) => startEdit(msg)}
                          canEdit={canEditMessage(m, currentUserId)}
                          repliedMessage={
                            m.reply_to_message_id
                              ? (messages.find(
                                  (x) => x.message_id === m.reply_to_message_id,
                                ) ?? null)
                              : null
                          }
                          onJumpToReplied={(id) => scrollToMessage(id)}
                          highlighted={highlightId === m.message_id}
                          otherUserName={otherUserName}
                          otherUserInitials={otherUserInitials}
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>
            </ScrollArea>
            <Separator />
            {/* Composer */}
            <div className="p-3">
              <div className="mx-auto flex w-full max-w-3xl items-end gap-2">
                {replyTo && (
                  <div className="bg-muted/40 mx-auto mb-2 w-full max-w-3xl rounded-md border px-3 py-2 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-muted-foreground mb-1">
                          תגובה להודעה
                        </div>
                        <div className="truncate">{replyTo.content}</div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setReplyTo(null)}
                        className="h-7 px-2"
                      >
                        ביטול
                      </Button>
                    </div>
                  </div>
                )}

                {editTarget && (
                  <div className="bg-muted/40 mx-auto mb-2 w-full max-w-3xl rounded-md border px-3 py-2 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-muted-foreground mb-1">
                          עריכת הודעה
                        </div>
                        <div className="truncate">{editTarget.content}</div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditTarget(null);
                          setDraft("");
                        }}
                        className="h-7 px-2"
                      >
                        ביטול
                      </Button>
                    </div>
                  </div>
                )}

                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="כתוב הודעה..."
                  disabled={!roomId || sending}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      onSend();
                    }
                  }}
                />
                <Button onClick={onSend} disabled={!roomId || sending}>
                  {sending ? "שולח..." : editTarget ? "שמור" : "שלח"}
                </Button>
              </div>
            </div>
          </main>
        </Box>
      </div>
    </div>
  );
}

function MessageBubble({
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

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("he-IL", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

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
              onDoubleClick={onReply} // אם את עדיין רוצה דאבל-קליק כקיצור
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

            {/* ✅ אפשרות עריכה */}
            {canEdit && (
              <ContextMenuItem onClick={() => onEdit(message)}>
                <Pencil className="mr-2 h-4 w-4" />
                ערוך
              </ContextMenuItem>
            )}
          </ContextMenuContent>
        </ContextMenu>

        {/* Avatar רק לצד השני (מינימלי) */}
        {!isMe && (
          <Avatar className="h-7 w-7">
            <AvatarFallback>{otherUserInitials}</AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  );
}
