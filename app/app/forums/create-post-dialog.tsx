"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { PenLine } from "lucide-react";

export default function CreatePostDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit() {
    if (!title.trim() || !body.trim()) {
      toast.error("יש למלא כותרת ותוכן");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/v1/forum/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body: body.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "שגיאה בפרסום");
        return;
      }
      toast.success("הפוסט פורסם בהצלחה");
      setOpen(false);
      setTitle("");
      setBody("");
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
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle>פוסט חדש בפורום</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="post-title">כותרת</Label>
              <Input
                id="post-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="נושא הפוסט..."
                maxLength={200}
                dir="rtl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="post-body">תוכן</Label>
              <Textarea
                id="post-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="כתוב את הפוסט כאן..."
                rows={6}
                maxLength={5000}
                dir="rtl"
              />
            </div>
          </div>
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
