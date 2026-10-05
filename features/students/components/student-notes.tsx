"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MessageSquareText, Pencil, Trash2, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Textarea } from "@/components/ui/textarea";
import type {
  ShadchanNote,
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
  author_id: string;
  author_name: string | null;
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

/** מצב ריק של רשימת הערות - `Empty` המשותף, על המשטח של המקטע שמסביבו */
function EmptyNotes({ text }: { text: string }) {
  return (
    <Empty
      size="compact"
      surface={false}
      className="rounded-lg border border-dashed border-border"
    >
      <EmptyMedia variant="icon">
        <MessageSquareText />
      </EmptyMedia>
      <EmptyHeader>
        <EmptyTitle>{text}</EmptyTitle>
      </EmptyHeader>
    </Empty>
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

/** שמירת עריכה/מחיקה של הערת שדכן. מחזיר true בהצלחה; בכשל המשתמש כבר קיבל הודעה. */
async function requestNoteChange(
  studentId: string,
  noteId: string,
  init: { method: "PATCH" | "DELETE"; body?: string },
): Promise<boolean> {
  try {
    const res = await fetch(`/api/v1/students/${studentId}/notes/${noteId}`, {
      method: init.method,
      headers: { "Content-Type": "application/json" },
      body:
        init.body === undefined
          ? undefined
          : JSON.stringify({ body: init.body }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || "הפעולה נכשלה");
      return false;
    }
    return true;
  } catch {
    toast.error("הפעולה נכשלה - בדקו את החיבור לרשת ונסו שוב");
    return false;
  }
}

/** עריכה במקום של הערה: תיבת טקסט עם שמירה וביטול */
function NoteEditor({
  initialBody,
  onSave,
  onCancel,
}: {
  initialBody: string;
  onSave: (body: string) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initialBody);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setSaving(true);
    const saved = await onSave(trimmed);
    if (!saved) setSaving(false);
  }

  return (
    <div className="mt-1.5 space-y-2">
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        disabled={saving}
        dir="rtl"
        maxLength={MAX_NOTE_LENGTH}
        className="min-h-20"
        aria-label="עריכת הערה"
      />
      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onCancel}
          disabled={saving}
        >
          ביטול
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving || !draft.trim()}
        >
          {saving ? "שומר..." : "שמירה"}
        </Button>
      </div>
    </div>
  );
}

function ShadchanNoteItem({
  note,
  onEdit,
  onDelete,
}: {
  note: ShadchanNote;
  onEdit: (id: string, body: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);

  async function handleSave(body: string): Promise<boolean> {
    const saved = await onEdit(note.id, body);
    if (saved) setIsEditing(false);
    return saved;
  }

  return (
    <li className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-caption font-bold text-foreground">
            {note.authorName}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <span className="text-caption text-muted-foreground">
            {formatNoteDate(note.createdAt)}
          </span>
          {note.canManage && !isEditing && (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                title="עריכת ההערה"
                aria-label="עריכת ההערה"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-destructive hover:text-destructive"
                title="מחיקת ההערה"
                aria-label="מחיקת ההערה"
                onClick={() => onDelete(note.id)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </>
          )}
        </span>
      </div>
      {isEditing ? (
        <NoteEditor
          initialBody={note.body}
          onSave={handleSave}
          onCancel={() => setIsEditing(false)}
        />
      ) : (
        <p className="mt-1.5 text-body-sm leading-relaxed whitespace-pre-wrap text-foreground">
          {note.body}
        </p>
      )}
    </li>
  );
}

/**
 * "הערות שדכן": הערות עבודה של שדכנים. גלויות לכל השדכנים ולמנהלי המערכת
 * (RLS), עם שם הכותב והתאריך; לא לבעל הכרטיס, לא לאנשי צוות ולא בשיתוף
 * הכרטיס. עריכה ומחיקה - לכותב בלבד (מנהל: לכל ההערות).
 */
export function ShadchanNotes({
  studentId,
  initialNotes,
}: {
  studentId: string;
  initialNotes: ShadchanNote[];
}) {
  const [notes, setNotes] = useState<ShadchanNote[]>(initialNotes);

  async function handleSubmit(body: string): Promise<boolean> {
    const created = await postNote(studentId, "shadchan_note", body);
    if (!created) return false;
    setNotes((prev) => [
      {
        id: created.id,
        body: created.body,
        createdAt: created.created_at,
        authorId: created.author_id,
        authorName: created.author_name || "את/ה",
        canManage: true,
      },
      ...prev,
    ]);
    toast.success("ההערה נשמרה");
    return true;
  }

  async function handleEdit(id: string, body: string): Promise<boolean> {
    const saved = await requestNoteChange(studentId, id, {
      method: "PATCH",
      body,
    });
    if (!saved) return false;
    setNotes((prev) =>
      prev.map((note) => (note.id === id ? { ...note, body } : note)),
    );
    toast.success("ההערה עודכנה");
    return true;
  }

  async function handleDelete(id: string): Promise<void> {
    if (!confirm("למחוק את ההערה?")) return;
    const deleted = await requestNoteChange(studentId, id, {
      method: "DELETE",
    });
    if (!deleted) return;
    setNotes((prev) => prev.filter((note) => note.id !== id));
    toast.success("ההערה נמחקה");
  }

  return (
    <div className="space-y-4">
      <p className="flex items-center gap-1.5 text-caption text-muted-foreground">
        <Users className="size-3.5 shrink-0" aria-hidden />
        גלוי לכל השדכנים ולמנהלי המערכת - לא לבעל הכרטיס ולא בשיתוף הכרטיס.
      </p>
      <NoteComposer
        placeholder="הערה על המיועד/ת, גלויה לשדכנים..."
        submitLabel="שמירת הערה"
        onSubmit={handleSubmit}
      />
      {notes.length === 0 ? (
        <EmptyNotes text="עדיין אין הערות שדכנים על כרטיס זה" />
      ) : (
        <ul className="space-y-3">
          {notes.map((note) => (
            <ShadchanNoteItem
              key={note.id}
              note={note}
              onEdit={handleEdit}
              onDelete={handleDelete}
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
