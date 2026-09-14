"use client";

import * as React from "react";
import { Check, Pencil, Reply, SendHorizontal, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/** מספר השורות המרבי לפני שהשדה מתחיל לגלול במקום לגדול. */
const MAX_ROWS = 5;

export type ComposerBanner = {
  kind: "reply" | "edit";
  /** מזהה ההודעה — שינוי שלו מחזיר את הפוקוס לשדה. */
  messageId: string;
  title: string;
  content: string;
};

type ChatComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancelBanner: () => void;
  isSending: boolean;
  banner: ComposerBanner | null;
};

/** השדה גדל עם התוכן עד MAX_ROWS שורות, ואז גולל. */
function useAutoGrow(
  ref: React.RefObject<HTMLTextAreaElement | null>,
  value: string,
) {
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const style = getComputedStyle(el);
    const maxHeight =
      parseFloat(style.lineHeight) * MAX_ROWS +
      parseFloat(style.paddingTop) +
      parseFloat(style.paddingBottom);
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [ref, value]);
}

export function ChatComposer({
  value,
  onChange,
  onSubmit,
  onCancelBanner,
  isSending,
  banner,
}: ChatComposerProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  useAutoGrow(textareaRef, value);

  const bannerKey = banner ? `${banner.kind}:${banner.messageId}` : null;
  React.useEffect(() => {
    if (bannerKey) textareaRef.current?.focus();
  }, [bannerKey]);

  const isEdit = banner?.kind === "edit";
  const canSubmit = !isSending && value.trim().length > 0;

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter שולח, Shift+Enter יורד שורה. בזמן הרכבת תווים (IME) לא שולחים.
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (canSubmit) onSubmit();
      return;
    }
    if (e.key === "Escape" && banner) {
      e.preventDefault();
      onCancelBanner();
    }
  }

  return (
    <div className="shrink-0 border-t border-border bg-card px-3 pt-2.5 pb-3 md:px-4">
      {banner && (
        <div className="mb-2 flex items-start gap-2 rounded-lg border-s-2 border-primary bg-primary-muted py-1.5 ps-3 pe-1">
          {banner.kind === "reply" ? (
            <Reply
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-primary"
            />
          ) : (
            <Pencil
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-primary"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-caption font-semibold text-primary">
              {banner.title}
            </p>
            <p className="truncate text-caption text-muted-foreground">
              {banner.content}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onCancelBanner}
            aria-label={isEdit ? "ביטול העריכה" : "ביטול התגובה"}
            className="shrink-0 rounded-full text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </Button>
        </div>
      )}

      <div className="flex items-end gap-2 rounded-3xl border border-input bg-background py-1.5 ps-4 pe-1.5 transition-colors focus-within:border-ring">
        <Textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="כתבו הודעה…"
          aria-label="הודעה חדשה"
          enterKeyHint="send"
          className="min-h-0 resize-none rounded-none border-0 bg-transparent px-0 py-1.5 shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        <Button
          type="button"
          onClick={onSubmit}
          // ריק או באמצע שליחה — אין מה לשלוח
          disabled={!canSubmit}
          size="icon"
          className="size-9 shrink-0 rounded-full"
          aria-label={isEdit ? "שמירת העריכה" : "שליחת הודעה"}
        >
          {isEdit ? (
            <Check className="size-4" />
          ) : (
            // האייקון מצביע ימינה כברירת מחדל; ב-RTL השליחה "זורמת" שמאלה
            <SendHorizontal className="size-4 -scale-x-100" />
          )}
        </Button>
      </div>
    </div>
  );
}
