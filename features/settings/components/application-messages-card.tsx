"use client";

import { useEffect, useState } from "react";

import { ApplicationMessagesList } from "@/features/admin/components/application-messages-list";
import {
  fetchApplicationMessages,
  type ApplicationMessage,
} from "@/features/admin/lib/application-messages";
import { Card, CardContent } from "@/components/ui/card";
import type { ApplicationKind } from "@/lib/email/templates/application-decision";
import { createClient } from "@/lib/supabase/client";

const HEADING = "הודעות מההנהלה";

/**
 * הודעות שהנהלת האתר שלחה למבקש/ת על בקשת ההצטרפות. נשלף עם הלקוח של
 * המשתמש (RLS: רק ההודעות שלו), ולכן מוצג גם כשהבקשה אושרה או נדחתה.
 * לא מציג דבר כשאין הודעות.
 */
export function ApplicationMessagesCard({ kind }: { kind: ApplicationKind }) {
  const [messages, setMessages] = useState<readonly ApplicationMessage[]>([]);

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const loaded = await fetchApplicationMessages(supabase, kind, user.id);
      if (isActive) setMessages(loaded);
    };
    void load();
    return () => {
      isActive = false;
    };
  }, [kind]);

  if (messages.length === 0) return null;

  return (
    <Card>
      <CardContent>
        <ApplicationMessagesList messages={messages} heading={HEADING} />
      </CardContent>
    </Card>
  );
}
