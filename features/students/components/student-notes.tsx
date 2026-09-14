"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Lock, MessageSquareText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type {
  PrivateNote,
  StaffFeedback,
} from "@/features/students/lib/student-notes-data";

const MAX_NOTE_LENGTH = 2000;

type NoteKind = "shadchan_note" | "staff_feedback";

/** השורה שמחזיר app/api/v1/students/[studentId]/notes/route.ts */
type CreatedNote = {
  id: string;
  body: string;
  created_at: string;
  institution_name: string | null;
  institution_city: string | null;
};

function formatNoteDate(dateString: string): string {
  return new Intl.DateTimeFormat("he-IL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateString));
}

function formatInstitution(name: string | null, city: string | null): string {
  if (!name) return "איש צוות";
  return city ? `איש צוות · ${name}, ${city}` : `איש צוות · ${name}`;
}

/** שומר הערה/פידבק. מחזיר null בכשל, אחרי שהמשתמש קיבל הודעה. */
async function postNote(
  studentId: string,
  kind: NoteKind,
  body: string,
): Promise<CreatedNote | null> {
  try {
    const res = await fetch(`/api/v1/students/${studentId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, kind }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || "שגיאה בשמירה");
      return null;
    }
    const { note }: { note: CreatedNote } = await res.json();
    return note;
  } catch {
    toast.error("שגיאה בשמירה - בדקו את החיבור לרשת ונסו שוב");
    return null;
  }
}

function NoteComposer({
  placeholder,
  submitLabel,
  onSubmit,
}: {
  placeholder: string;
  submitLabel: string;
  onSubmit: (body: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setSubmitting(true);
    const saved = await onSubmit(trimmed);
    if (saved) setDraft("");
    setSubmitting(false);
  }

  return (
    <div className="space-y-2">
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        disabled={submitting}
        dir="rtl"
        maxLength={MAX_NOTE_LENGTH}
        className="min-h-24"
      />
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={submitting || !draft.trim()}
        >
          {submitting ? "שומר..." : submitLabel}
        </Button>
      </div>
    </div>
  );
}

function EmptyNotes({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-8 text-center">
      <MessageSquareText className="h-6 w-6 text-muted-foreground" />
      <p className="text-body-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function NoteItem({
  heading,
  createdAt,
  body,
}: {
  heading?: React.ReactNode;
  createdAt: string;
  body: string;
}) {
  return (
    <li className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex flex-wrap items-baseline gap-x-1.5">
          {heading}
        </span>
        <span className="shrink-0 text-caption text-muted-foreground">
          {formatNoteDate(createdAt)}
        </span>
      </div>
      <p className="mt-1.5 text-body-sm leading-relaxed whitespace-pre-wrap text-foreground">
        {body}
      </p>
    </li>
  );
}

/**
 * "הערות שדכן": הערות עבודה פרטיות. גלויות לכותב בלבד (RLS), ואינן נכללות
 * בשיתוף הכרטיס.
 */
export function ShadchanNotes({
  studentId,
  initialNotes,
}: {
  studentId: string;
  initialNotes: PrivateNote[];
}) {
  const [notes, setNotes] = useState<PrivateNote[]>(initialNotes);

  async function handleSubmit(body: string): Promise<boolean> {
    const created = await postNote(studentId, "shadchan_note", body);
    if (!created) return false;
    setNotes((prev) => [
      { id: created.id, body: created.body, created_at: created.created_at },
      ...prev,
    ]);
    toast.success("ההערה נשמרה");
    return true;
  }

  return (
    <div className="space-y-4">
      <p className="flex items-center gap-1.5 text-caption text-muted-foreground">
        <Lock className="size-3.5 shrink-0" aria-hidden />
        גלוי לך בלבד - לא לשדכנים אחרים ולא בשיתוף הכרטיס.
      </p>
      <NoteComposer
        placeholder="הערה פרטית על המיועד/ת..."
        submitLabel="שמירת הערה"
        onSubmit={handleSubmit}
      />
      {notes.length === 0 ? (
        <EmptyNotes text="עדיין לא כתבת הערות על כרטיס זה" />
      ) : (
        <ul className="space-y-3">
          {notes.map((note) => (
            <NoteItem
              key={note.id}
              createdAt={note.created_at}
              body={note.body}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * "פידבק אנשי צוות": מחמאות וחוות דעת של אנשי חינוך, עם שם הכותב. גלוי
 * לכל מי שרואה את הכרטיס, כולל בשיתוף. canWrite רק לאיש צוות.
 */
export function StaffFeedbackList({
  studentId,
  initialFeedback,
  canWrite,
  currentUserName,
}: {
  studentId: string;
  initialFeedback: StaffFeedback[];
  canWrite: boolean;
  currentUserName?: string;
}) {
  const [feedback, setFeedback] = useState<StaffFeedback[]>(initialFeedback);

  async function handleSubmit(body: string): Promise<boolean> {
    const created = await postNote(studentId, "staff_feedback", body);
    if (!created) return false;
    setFeedback((prev) => [
      {
        id: created.id,
        body: created.body,
        createdAt: created.created_at,
        authorName: currentUserName || "את/ה",
        institutionName: created.institution_name,
        institutionCity: created.institution_city,
      },
      ...prev,
    ]);
    toast.success("הפידבק נוסף");
    return true;
  }

  return (
    <div className="space-y-4">
      {canWrite && (
        <NoteComposer
          placeholder="כתבו מחמאה או חוות דעת על המיועד/ת - תוצג יחד עם שמכם"
          submitLabel="הוספת פידבק"
          onSubmit={handleSubmit}
        />
      )}
      {feedback.length === 0 ? (
        <EmptyNotes text="עדיין אין פידבק מאנשי צוות על כרטיס זה" />
      ) : (
        <ul className="space-y-3">
          {feedback.map((item) => (
            <NoteItem
              key={item.id}
              createdAt={item.createdAt}
              body={item.body}
              heading={
                <>
                  <span className="text-caption font-bold text-foreground">
                    {item.authorName}
                  </span>
                  <span className="text-caption text-muted-foreground">
                    {formatInstitution(
                      item.institutionName,
                      item.institutionCity,
                    )}
                  </span>
                </>
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}
