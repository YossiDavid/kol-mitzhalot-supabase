"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MessageSquareText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export type NoteAuthorRole = "staff" | "shadchan" | "admin";

export type NoteAuthorInstitution = {
  name: string;
  city: string | null;
  type: string | null;
};

export type Note = {
  id: string;
  body: string;
  created_at: string;
  author_name: string;
  author_role: NoteAuthorRole;
  author_institution?: NoteAuthorInstitution | null;
};

// שורת ה-JSON שמוחזרת ע"י app/api/v1/students/[studentId]/notes/route.ts
// לאחר יצירת הערה - כולל את כל השדות הדרושים לתצוגה האופטימית המיידית,
// בלי צורך ברענון הדף.
type CreatedNoteResponse = {
  id: string;
  body: string;
  created_at: string;
  author_role: NoteAuthorRole;
  institutions: NoteAuthorInstitution | null;
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

// שורת השיוך הקצרה שמוצגת ליד שם המחבר - תמיד נגזרת מתמונת המצב שנשמרה
// על ההערה עצמה (author_role/author_institution), לא ממצב המשתמש הנוכחי.
function formatAuthorAttribution(note: Note): string {
  if (note.author_role === "shadchan") return "שדכן";
  if (note.author_role === "admin") return "מנהל מערכת";

  // author_role === "staff"
  if (!note.author_institution) return "איש צוות";

  const { name, city } = note.author_institution;
  return city ? `איש צוות · ${name}, ${city}` : `איש צוות · ${name}`;
}

export default function StudentNotes({
  studentId,
  canWrite,
  initialNotes,
}: {
  studentId: string;
  canWrite: boolean;
  initialNotes: Note[];
}) {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    const trimmed = draft.trim();
    if (!trimmed) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/students/${studentId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: trimmed }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "שגיאה בשמירת ההערה");
        return;
      }

      const { note }: { note: CreatedNoteResponse } = await res.json();
      setNotes((prev) => [
        {
          id: note.id,
          body: note.body,
          created_at: note.created_at,
          author_name: "את/ה",
          author_role: note.author_role,
          author_institution: note.institutions,
        },
        ...prev,
      ]);
      setDraft("");
      toast.success("ההערה נוספה בהצלחה");
    } catch {
      toast.error("שגיאה בשמירת ההערה - בדקו את החיבור לרשת ונסו שוב");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {canWrite && (
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="כתבו כאן מחמאה או הערה על המיועד/ת..."
            disabled={submitting}
            dir="rtl"
            maxLength={2000}
            className="min-h-24"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={submitting || !draft.trim()}
            >
              {submitting ? "שומר..." : "הוספת הערה"}
            </Button>
          </div>
        </div>
      )}

      {notes.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-8 text-center">
          <MessageSquareText className="h-6 w-6 text-muted-foreground" />
          <p className="text-body-sm text-muted-foreground">
            עדיין אין מחמאות או הערות על כרטיס זה
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {notes.map((note) => (
            <li
              key={note.id}
              className="rounded-lg border border-border bg-muted/30 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex flex-wrap items-baseline gap-x-1.5">
                  <span className="text-caption font-bold text-foreground">
                    {note.author_name}
                  </span>
                  <span className="text-caption text-muted-foreground">
                    {formatAuthorAttribution(note)}
                  </span>
                </span>
                <span className="shrink-0 text-caption text-muted-foreground">
                  {formatNoteDate(note.created_at)}
                </span>
              </div>
              <p className="mt-1.5 text-body-sm leading-relaxed whitespace-pre-wrap text-foreground">
                {note.body}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
