"use client";

import * as React from "react";
import { MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { EmbeddedChat } from "@/features/chats/components/embedded-chat";
import {
  openContextRoom,
  openRoomErrorMessage,
} from "@/features/chats/lib/open-room";
import { createClient } from "@/lib/supabase/client";

type ProposalThreadPanelProps = {
  shidduchId: string;
  /** מי בצד השני של השרשור: מנהל הכרטיס של הצד (לשדכן) או השדכן (להורה) */
  otherUserId: string;
  /** כותרת הפאנל, למשל "שיחה עם צד החתן" */
  title: string;
};

/**
 * השרשור המלא של ההצעה מול צד אחד, מוטמע בעמוד ההצעה. מציג את אותו חדר
 * שנפתח בצ'אטים (הקשר shidduch). אין חדר עדיין -> כפתור פתיחה; החדר נוצר
 * רק בלחיצה, כך שעצם הצפייה בהצעה אינה יוצרת שיחות.
 */
export default function ProposalThreadPanel({
  shidduchId,
  otherUserId,
  title,
}: ProposalThreadPanelProps) {
  const supabase = React.useMemo(() => createClient(), []);
  const [roomId, setRoomId] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isOpening, setIsOpening] = React.useState(false);

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

  async function openThread() {
    setIsOpening(true);
    try {
      setRoomId(
        await openContextRoom(otherUserId, { kind: "shidduch", shidduchId }),
      );
    } catch (error) {
      toast.error(openRoomErrorMessage(error));
    } finally {
      setIsOpening(false);
    }
  }

  return (
    <section aria-label={title} className="space-y-3 border-t pt-4">
      <h3 className="text-body font-semibold">{title}</h3>
      {roomId ? (
        <EmbeddedChat roomId={roomId} />
      ) : (
        <Button
          type="button"
          variant="outline"
          disabled={isLoading || isOpening}
          onClick={() => void openThread()}
        >
          <MessageSquarePlus />
          {isOpening ? "פותח שיחה..." : "התחלת שיחה"}
        </Button>
      )}
    </section>
  );
}
