"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogDescription,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import PostFormFields, {
  type PostFormValues,
} from "@/features/forums/components/post-form-fields";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { PenLine } from "lucide-react";
import type { ForumCategory } from "@/features/forums/lib/types";

const EMPTY_VALUES: PostFormValues = { categoryId: "", title: "", body: "" };

export default function CreatePostDialog({
  categories,
}: {
  categories: ForumCategory[];
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<PostFormValues>(EMPTY_VALUES);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit() {
    if (!values.title.trim() || !values.body.trim()) {
      toast.error("יש למלא כותרת ותוכן");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/v1/forum/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: values.title.trim(),
          content: values.body.trim(),
          categoryId: values.categoryId || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "שגיאה בפרסום");
        return;
      }
      toast.success("הפוסט פורסם בהצלחה");
      setOpen(false);
      setValues(EMPTY_VALUES);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PenLine className="h-4 w-4" />
        פוסט חדש
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>פוסט חדש בפורום</DialogTitle>
            <DialogDescription>
              הפוסט יפורסם בפורום ויהיה גלוי לשאר השדכנים.
            </DialogDescription>
          </DialogHeader>
          <PostFormFields
            categories={categories}
            values={values}
            onChange={setValues}
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              ביטול
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? "מפרסם..." : "פרסם"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
