"use client";

import * as React from "react";
import { MessagesSquare, SendHorizontal } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmbeddedChat } from "@/features/chats/components/embedded-chat";
import {
  openContextRoom,
  openRoomErrorMessage,
} from "@/features/chats/lib/open-room";
import { sendChatMessage } from "@/features/students/components/message-button";
import { createClient } from "@/lib/supabase/client";

import { proposalThreadAnchor } from "@/features/shidduchim/lib/proposal-thread-anchor";
import { formatDateTime } from "@/features/shidduchim/lib/responses";

const FIRST_MESSAGE_MAX_LENGTH = 4000;

/** ההערה שנשלחה עם ההצעה לצד הזה, מוצגת כהודעת הפתיחה של השיחה */
export type OpeningNote = {
  text: string;
  sentAt: string | null;
  /** מי כתב, למשל "השדכן" */
  fromLabel: string;
};

type ProposalThreadPanelProps = {
  shidduchId: string;
  /** מי בצד השני של השרשור: מנהל הכרטיס של הצד (לשדכן) או השדכן (להורה) */
  otherUserId: string;
  /** מול מי השיחה, למשל "צד החתן" או "השדכן" */
  withLabel: string;
  /** תצוגה בלבד: אינה נשמרת כהודעת צ'אט */
  openingNote?: OpeningNote;
};

/**
 * השרשור המלא של ההצעה מול צד אחד, מוטמע תמיד פתוח בעמוד ההצעה: כותרת
 * "שיחה על ההצעה", כל ההיסטוריה ושדה כתיבה. מציג את אותו חדר שנפתח
 * בצ'אטים (הקשר shidduch). אין חדר עדיין -> שדה כתיבה שההודעה הראשונה בו
 * יוצרת את החדר, כך שעצם הצפייה בהצעה אינה יוצרת שיחות.
 *
 * ה-id של האזור הוא עוגן: קישור ההתראה והרשימות מגיעים אליו ב-hash.
 */
export default function ProposalThreadPanel({
  shidduchId,
  otherUserId,
  withLabel,
  openingNote,
}: ProposalThreadPanelProps) {
  const supabase = React.useMemo(() => createClient(), []);
  const [roomId, setRoomId] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSending, setIsSending] = React.useState(false);
  const [draft, setDraft] = React.useState("");

  React.useEffect(() => {
    let isMounted = true;
    // RLS מגביל לחדרים שאני חבר בהם, ולכן "הצד השני הוא otherUserId" מספיק
    supabase
      .from("chat_rooms")
      .select("room_id")
      .eq("context_kind", "shidduch")
      .eq("shidduch_id", shidduchId)
      .or(`user_a.eq.${otherUserId},user_b.eq.${otherUserId}`)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) toast.error("שגיאה בטעינת השיחה");
        setRoomId(data?.room_id ?? null);
        setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [shidduchId, otherUserId, supabase]);

  async function startThread() {
    const body = draft.trim();
    if (!body) {
      toast.error("יש לכתוב הודעה");
      return;
    }
    setIsSending(true);
    try {
      const newRoomId = await openContextRoom(otherUserId, {
        kind: "shidduch",
        shidduchId,
      });
      await sendChatMessage(newRoomId, body);
      setDraft("");
      setRoomId(newRoomId);
    } catch (error) {
      toast.error(openRoomErrorMessage(error));
    } finally {
      setIsSending(false);
    }
  }

  const title = `שיחה על ההצעה - עם ${withLabel}`;

  return (
    <section
      id={proposalThreadAnchor(otherUserId)}
      aria-label={title}
      className="scroll-mt-20 space-y-3 border-t pt-4"
    >
      <div className="flex items-center gap-2">
        <MessagesSquare
          aria-hidden="true"
          className="size-5 text-muted-foreground"
        />
        <div>
          <h3 className="text-body font-semibold">שיחה על ההצעה</h3>
          <p className="text-body-sm text-muted-foreground">
            עם {withLabel}. אפשר להמשיך לעדכן כאן גם אחרי שההצעה נענתה.
          </p>
        </div>
      </div>

      {openingNote && (
        <div
          data-testid="proposal-opening-note"
          className="rounded-lg border bg-muted/50 p-3"
        >
          <p className="mb-1 text-caption text-muted-foreground">
            הערת {openingNote.fromLabel} שנשלחה עם ההצעה
            {openingNote.sentAt && ` · ${formatDateTime(openingNote.sentAt)}`}
          </p>
          <p className="text-body-sm whitespace-pre-wrap">{openingNote.text}</p>
        </div>
      )}

      {roomId ? (
        <EmbeddedChat roomId={roomId} />
      ) : (
        <div className="space-y-2">
          <Textarea
            rows={3}
            maxLength={FIRST_MESSAGE_MAX_LENGTH}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="כתבו הודעה…"
            aria-label="הודעה חדשה"
            disabled={isLoading || isSending}
          />
          <Button
            type="button"
            disabled={isLoading || isSending || draft.trim().length === 0}
            onClick={() => void startThread()}
          >
            <SendHorizontal className="-scale-x-100" />
            {isSending ? "שולח..." : "שליחת הודעה"}
          </Button>
        </div>
      )}
    </section>
  );
}
