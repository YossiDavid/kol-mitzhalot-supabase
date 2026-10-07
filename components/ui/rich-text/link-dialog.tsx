"use client";

import type { Editor } from "@tiptap/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { normalizeLinkUrl } from "./link-url";

interface LinkDialogProps {
  editor: Editor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * חלון הוספת קישור מפקודת "/". אין form: החלון נטען ב-portal אך אירועי
 * React עולים אל הטופס המקיף (עמוד המאמר), ושליחה כפולה לא רצויה.
 */
export function LinkDialog({ editor, open, onOpenChange }: LinkDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        {/* התוכן נטען רק כשהחלון פתוח, כדי שהשדות יתאפסו בכל פתיחה */}
        {open && <LinkDialogBody editor={editor} onDone={onOpenChange} />}
      </DialogContent>
    </Dialog>
  );
}

function LinkDialogBody({
  editor,
  onDone,
}: {
  editor: Editor;
  onDone: (open: boolean) => void;
}) {
  const hasSelection = !editor.state.selection.empty;
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  function apply() {
    const href = normalizeLinkUrl(url);
    if (!href) {
      setError("יש להזין כתובת תקינה, למשל https://example.com");
      return;
    }
    const chain = editor.chain().focus();
    if (hasSelection) {
      chain.setLink({ href }).run();
    } else {
      chain
        .insertContent({
          type: "text",
          text: text.trim() || href,
          marks: [{ type: "link", attrs: { href } }],
        })
        .run();
    }
    onDone(false);
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>הוספת קישור</DialogTitle>
        <DialogDescription>
          {hasSelection
            ? "הקישור יוחל על הטקסט שנבחר."
            : "הקישור יוכנס במקום הסמן."}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="link-dialog-url">כתובת הקישור</Label>
          <Input
            id="link-dialog-url"
            dir="ltr"
            inputMode="url"
            placeholder="https://example.com"
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
              setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              apply();
            }}
            aria-invalid={error !== null}
            aria-describedby={error ? "link-dialog-error" : undefined}
            autoFocus
          />
          {error && (
            <p
              id="link-dialog-error"
              role="alert"
              className="text-body-sm text-destructive"
            >
              {error}
            </p>
          )}
        </div>
        {!hasSelection && (
          <div className="grid gap-2">
            <Label htmlFor="link-dialog-text">טקסט הקישור (לא חובה)</Label>
            <Input
              id="link-dialog-text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                apply();
              }}
            />
          </div>
        )}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onDone(false)}>
          ביטול
        </Button>
        <Button type="button" onClick={apply}>
          הוספה
        </Button>
      </DialogFooter>
    </>
  );
}
