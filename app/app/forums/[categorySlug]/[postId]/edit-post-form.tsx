"use client";

import { useTransition, useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updatePost } from "../../actions";

export function EditPostForm({
  postId,
  defaultTitle,
  defaultContent,
  defaultTags,
}: {
  postId: string;
  defaultTitle: string;
  defaultContent: string;
  defaultTags: string[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await updatePost(postId, formData);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Pencil className="me-1 h-4 w-4" />
          ערוך
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>עריכת נושא</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-title">כותרת</Label>
            <Input
              id="edit-title"
              name="title"
              defaultValue={defaultTitle}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-content">תוכן</Label>
            <Textarea
              id="edit-content"
              name="content"
              defaultValue={defaultContent}
              rows={8}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-tags">תגיות (מופרדות בפסיקים)</Label>
            <Input
              id="edit-tags"
              name="tags"
              defaultValue={defaultTags.join(", ")}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              ביטול
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "שומר..." : "שמור שינויים"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
