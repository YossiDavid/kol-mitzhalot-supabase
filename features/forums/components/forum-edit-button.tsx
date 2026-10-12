"use client";

import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import PostFormFields, {
  type PostFormValues,
} from "@/features/forums/components/post-form-fields";
import {
  FORUM_REPLY_MAX,
  type ForumCategory,
} from "@/features/forums/lib/types";

type EditTarget =
  | {
      kind: "post";
      id: string;
      title: string;
      content: string;
      categoryId: string | null;
      categories: ForumCategory[];
    }
  | { kind: "reply"; id: string; content: string };

/** הגוף שנשלח ל-PATCH: אותם שדות כמו ביצירה, בלי מזהים או דגלים */
function buildBody(
  target: EditTarget,
  values: PostFormValues,
  replyContent: string,
) {
  if (target.kind === "reply") return { content: replyContent.trim() };
  return {
    title: values.title.trim(),
    content: values.body.trim(),
    categoryId: values.categoryId || null,
  };
}

function initialValues(target: EditTarget): PostFormValues {
  if (target.kind === "reply") return { categoryId: "", title: "", body: "" };
  return {
    categoryId: target.categoryId ?? "",
    title: target.title,
    body: target.content,
  };
}

/**
 * כפתור "עריכה" עם דיאלוג, לפוסט או לתגובה. מוצג רק לכותב התוכן (מנהל אינו
 * עורך: מדיניות ה-UPDATE במסד היא של הכותב בלבד); ה-RLS הוא האוכף האמיתי.
 * הטופס זהה ליצירה, ממולא מראש, ואחרי שמירה הדף מתרענן במקום.
 */
export default function ForumEditButton({ target }: { target: EditTarget }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [values, setValues] = useState<PostFormValues>(initialValues(target));
  const [replyContent, setReplyContent] = useState(
    target.kind === "reply" ? target.content : "",
  );

  const isPost = target.kind === "post";
  const noun = isPost ? "פוסט" : "תגובה";
  const url = isPost
    ? `/api/v1/forum/posts/${target.id}`
    : `/api/v1/forum/replies/${target.id}`;

  const isEmpty = isPost
    ? !values.title.trim() || !values.body.trim()
    : !replyContent.trim();
  const isUnchanged = isPost
    ? values.title.trim() === target.title &&
      values.body.trim() === target.content &&
      (values.categoryId || null) === target.categoryId
    : replyContent.trim() === target.content;

  function handleOpenChange(next: boolean) {
    // בפתיחה מחדש מציגים את הערכים השמורים, לא טיוטה שננטשה
    if (next) {
      setValues(initialValues(target));
      setReplyContent(target.kind === "reply" ? target.content : "");
    }
    setIsOpen(next);
  }

  async function handleSave() {
    if (isEmpty) {
      toast.error(isPost ? "יש למלא כותרת ותוכן" : "יש לכתוב תגובה");
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody(target, values, replyContent)),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || `עריכת ה${noun} נכשלה, נסו שוב`);
        return;
      }
      toast.success(isPost ? "הפוסט עודכן" : "התגובה עודכנה");
      setIsOpen(false);
      router.refresh();
    } catch {
      toast.error(`עריכת ה${noun} נכשלה, נסו שוב`);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => handleOpenChange(true)}
        aria-label={`עריכת ה${noun}`}
      >
        <Pencil className="size-4" aria-hidden />
        <span>עריכה</span>
      </Button>
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isPost ? "עריכת פוסט" : "עריכת תגובה"}</DialogTitle>
            <DialogDescription>
              השינויים יוצגו לשאר השדכנים, והפריט יסומן כ״נערך״.
            </DialogDescription>
          </DialogHeader>
          {target.kind === "post" ? (
            <PostFormFields
              categories={target.categories}
              values={values}
              onChange={setValues}
            />
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="reply-edit">תוכן התגובה</Label>
              <Textarea
                id="reply-edit"
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                rows={5}
                maxLength={FORUM_REPLY_MAX}
                dir="rtl"
              />
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              ביטול
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving || isUnchanged}
            >
              {isSaving ? "שומר..." : "שמירה"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
