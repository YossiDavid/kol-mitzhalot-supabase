"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FORUM_REPLY_MAX } from "@/features/forums/lib/types";

export default function ReplyForm({ postId }: { postId: string }) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!content.trim()) {
      toast.error("יש לכתוב תגובה");
      return;
    }
    setIsSending(true);
    try {
      const res = await fetch(`/api/v1/forum/posts/${postId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "שגיאה בשליחת התגובה");
        return;
      }
      toast.success("התגובה פורסמה");
      setContent("");
      router.refresh();
    } finally {
      setIsSending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Label htmlFor="forum-reply">הוספת תגובה</Label>
      <Textarea
        id="forum-reply"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="כתבו תגובה..."
        rows={4}
        maxLength={FORUM_REPLY_MAX}
        dir="rtl"
      />
      <Button type="submit" disabled={isSending}>
        {isSending ? "שולח..." : "פרסום תגובה"}
      </Button>
    </form>
  );
}
